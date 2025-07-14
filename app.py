from flask import Flask, render_template, request, jsonify
import os
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore
import json

load_dotenv()
cred_path = os.getenv("FIREBASE_CREDENTIALS")
cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred)
db = firestore.client()

app = Flask(__name__, static_folder='static', template_folder='templates')

@app.route("/")
def home():
  return render_template("login.html")

@app.route("/assign_user_role", methods=["POST"])
def assign_user_role():
    data = request.get_json()
    uid = data.get("uid")
    email = data.get("email")
    username = data.get("username")

    db.collection("users").document(uid).set({
        "email": email,
        "username": username,
        "role": "user"
    })

    return {"status": "role and username assigned"}, 200

@app.route("/admin_dashboard")
def admin_dashboard():
    return render_template("admin_dashboard.html")

@app.route("/user_dashboard")
def user_dashboard():
    return render_template("user_dashboard.html")

@app.route("/admin/data/teams")
def get_teams():
    teams = []
    for doc in db.collection("teams").stream():
        team = doc.to_dict()
        team["id"] = doc.id
        teams.append(team)
    return jsonify(teams)

@app.route("/admin/update/teams", methods=["POST", "PUT"])
def update_team():
    data = request.get_json()
    doc_id = data.get("id")
    team_name = data.get("name", "").strip()
    driver_names = [d.strip() for d in data.get("drivers", "").split(",")]

    # Create or update team
    team_data = {
        "name": team_name,
        "drivers": [],  # will store driver IDs
        "score": 0      # initially zero
    }

    team_ref = db.collection("teams").document(doc_id) if doc_id else db.collection("teams").document()
    team_ref.set(team_data)
    team_id = team_ref.id

    driver_ids = []
    for name in driver_names:
        # Check if driver exists
        driver_query = db.collection("drivers").where("name", "==", name).limit(1).get()
        if driver_query:
            driver_doc = driver_query[0].reference
        else:
            driver_doc = db.collection("drivers").document()

        driver_doc.set({
            "name": name,
            "team_id": team_id,
            "price": 0,
            "points": 0,
            "races": {}
        }, merge=True)

        driver_ids.append(driver_doc.id)

    # Update team with driver IDs
    team_ref.update({"drivers": driver_ids})

    return jsonify({"status": "team and drivers added"}), 200

@app.route("/admin/data/drivers")
def get_drivers():
    drivers = []
    for doc in db.collection("drivers").stream():
        driver = doc.to_dict()
        driver["id"] = doc.id
        drivers.append(driver)
    return jsonify(drivers)

@app.route("/admin/data/driver/<driver_id>")
def get_driver(driver_id):
    driver_doc = db.collection("drivers").document(driver_id).get()
    if driver_doc.exists:
        data = driver_doc.to_dict()
        data["id"] = driver_id
        return jsonify(data)
    return jsonify({"error": "Driver not found"}), 404

@app.route("/admin/update/drivers", methods=["POST", "PUT"])
def update_driver():
    data = request.get_json()
    doc_id = data.get("id")

    driver_data = {
        "name": data.get("name"),
        "price": int(data.get("price", 0)),
        "points": int(data.get("points", 0)),
        "team": data.get("team")
    }

    if request.method == "PUT" and doc_id:
        db.collection("drivers").document(doc_id).set(driver_data)
    else:
        db.collection("drivers").add(driver_data)

    return jsonify({"status": "success"}), 200

@app.route("/admin/data/races")
def get_races():
    races = []
    for doc in db.collection("races").stream():
        race = doc.to_dict()
        race["id"] = doc.id
        races.append(race)
    return jsonify(races)

@app.route("/admin/update/races", methods=["POST", "PUT"])
def update_race():
    data = request.get_json()
    race_id = data.get("id") or None
    race_name = data.get("name", "").strip()
    race_date = data.get("date", "").strip()

    #Parse the 'results' field from JSON string to dict
    try:
        name_results = json.loads(data.get("results", "{}"))
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON format in results"}), 400

    if not race_name or not race_date or not name_results:
        return jsonify({"error": "Missing race data"}), 400

    race_ref = db.collection("races").document(race_id) if race_id else db.collection("races").document()
    driver_results = {}

    for name, points in name_results.items():
        query = db.collection("drivers").where("name", ">=", name).where("name", "<=", name + "\uf8ff").limit(1).get()
        if query:
            driver_doc = query[0]
            driver_id = driver_doc.id
            driver_data = driver_doc.to_dict()

            new_total = driver_data.get("points", 0) + int(points)
            db.collection("drivers").document(driver_id).update({
                "points": new_total,
                f"races.{race_ref.id}": int(points)
            })

            driver_results[driver_id] = int(points)
        else:
            print(f"Driver '{name}' not found")

    #Save race with resolved driver IDs
    race_ref.set({
        "name": race_name,
        "date": race_date,
        "results": driver_results
    })

    #Recalculate team scores
    for team_doc in db.collection("teams").stream():
        team_data = team_doc.to_dict()
        total_score = 0
        for d_id in team_data.get("drivers", []):
            driver = db.collection("drivers").document(d_id).get().to_dict()
            total_score += driver.get("points", 0)
        db.collection("teams").document(team_doc.id).update({"score": total_score})

    return jsonify({"status": "Race recorded with driver names"}), 200

@app.route("/admin/data/leagues")
def get_leagues():
    leagues = []
    for doc in db.collection("leagues").stream():
        league = doc.to_dict()
        league["id"] = doc.id
        leagues.append(league)
    return jsonify(leagues)

@app.route("/admin/update/leagues", methods=["POST", "PUT"])
def update_league():
    data = request.get_json()
    doc_id = data.get("id")

    league_data = {
        "name": data.get("name"),
        "type": data.get("type"),  # "public" or "private"
        "users": [u.strip() for u in data.get("users", "").split(",")]
    }

    if request.method == "PUT" and doc_id:
        db.collection("leagues").document(doc_id).set(league_data)
    else:
        db.collection("leagues").add(league_data)

    return jsonify({"status": "success"}), 200

@app.route("/test_db")
def test_db():
    users_ref = db.collection("users").limit(1).stream()
    users = [doc.to_dict() for doc in users_ref]
    return {"status": "success", "data": users or "No users found"}

@app.route("/add_test_user")
def add_test_user():
    db.collection("users").document("test_user").set({
        "name": "Melvin",
        "email": "melvin@example.com"
    })
    return {"status": "test user added"}
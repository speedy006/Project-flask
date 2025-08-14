from flask import Flask, render_template, request, jsonify
import os
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore, auth
import json

load_dotenv()
cred_path = os.getenv("FIREBASE_CREDENTIALS")
cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred)
db = firestore.client()

def recalculate_fantasy_points_on_startup():
    teams = db.collection("fantasy_teams").stream()
    count = 0

    for team_doc in teams:
        team_data = team_doc.to_dict()
        driver_ids = team_data.get("drivers", [])
        constructor_id = team_data.get("team")
        fantasy_team_name = team_data.get("name", team_doc.id)

        total_points = 0
        print(f"\nUpdating team: {fantasy_team_name}")

        for did in driver_ids:
            ddoc = db.collection("drivers").document(did).get()
            if ddoc.exists:
                points = ddoc.to_dict().get("points", 0)
                print(f"  Driver {did}: {points} pts")
                total_points += points
            else:
                print(f"Driver '{did}' not found")

        if constructor_id:
            cdoc = db.collection("teams").document(constructor_id).get()
            if cdoc.exists:
                points = cdoc.to_dict().get("points", 0)
                print(f"  Constructor {constructor_id}: {points} pts")
                total_points += points
            else:
                print(f"Constructor '{constructor_id}' not found")

        team_doc.reference.update({ "points": total_points })
        print(f" Total updated: {total_points} pts")
        count += 1

    print(f"\nRecalculated {count} fantasy teams.\n")

app = Flask(__name__, static_folder='static', template_folder='templates')

print("\nFantasy team point recalculation...")
recalculate_fantasy_points_on_startup()

#Firebase token verification
def get_current_user_id():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token.get("uid")
    except Exception:
        return None

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

@app.route("/leagues")
def show_leagues():
    return render_template("leagues.html")

@app.route("/user_data")
def user_data():
    return render_template("user_data.html")

@app.route("/admin/data/teams")
def get_teams():
    all_drivers = {d.id: d.to_dict() for d in db.collection("drivers").stream()}
    teams = []

    for doc in db.collection("teams").stream():
        team = doc.to_dict()
        driver_names = [all_drivers.get(d_id, {}).get("name", "Unknown") for d_id in team.get("drivers", [])]
        team["driver_names"] = driver_names
        team["id"] = doc.id
        teams.append(team)

    return jsonify(teams)

@app.route("/admin/update/teams", methods=["POST", "PUT"])
def update_team():
    data = request.get_json()
    doc_id = data.get("id")
    team_name = data.get("name", "").strip()
    driver_ids = data.get("drivers", [])

    if not isinstance(driver_ids, list):
        return jsonify({"error": "Invalid driver format"}), 400

    # Safely parse score and price
    def safe_int(val, default=0):
        try:
            return int(str(val).strip())
        except (ValueError, TypeError):
            return default

    score = safe_int(data.get("score"), 0)
    price = safe_int(data.get("price"), 0)

    #Get or create the team document reference
    team_ref = db.collection("teams").document(doc_id) if doc_id else db.collection("teams").document()
    team_id = team_ref.id

    #Validate drivers
    conflicts = []
    for d_id in driver_ids:
        d_doc = db.collection("drivers").document(d_id).get()
        if d_doc.exists:
            current_team = d_doc.to_dict().get("team_id")
            if current_team and current_team != team_id:
                conflicts.append(d_id)

    if conflicts:
        return jsonify({
            "error": "Some drivers are already assigned to another team.",
            "conflicts": conflicts
        }), 400

    team_data = {
        "name": team_name,
        "drivers": driver_ids,
        "score": score,
        "price": price
    }

    #Update or create the team document
    if doc_id:
        team_ref.update(team_data)
    else:
        team_ref.set(team_data)

    #Assign team_id to drivers
    for d_id in driver_ids:
        db.collection("drivers").document(d_id).update({"team_id": team_id})

    return jsonify({"status": "Team created or updated successfully"}), 200

@app.route("/admin/data/drivers")
def get_drivers():
    teams = {t.id: t.to_dict().get("name", "Unknown") for t in db.collection("teams").stream()}
    drivers = []

    for doc in db.collection("drivers").stream():
        driver = doc.to_dict()
        driver["id"] = doc.id
        driver["team_name"] = teams.get(driver.get("team_id"), "Unassigned")
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

    def safe_int(value, default=0):
        try:
            return int(str(value).strip())
        except (ValueError, TypeError):
            return default

    driver_data = {
        "name": data.get("name", "").strip(),
        "price": safe_int(data.get("price")),
        "points": safe_int(data.get("points")),
        "team_id": data.get("team_id", "").strip() or None
    }

    if request.method == "PUT" and doc_id:
        db.collection("drivers").document(doc_id).update(driver_data)
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
    name_results = data.get("results", {})  # Already a dict

    if not race_name or not race_date or not name_results:
        return jsonify({"error": "Missing race data"}), 400

    race_ref = db.collection("races").document(race_id) if race_id else db.collection("races").document()
    driver_results = {}

    for driver_id, points in name_results.items():
        driver_doc = db.collection("drivers").document(driver_id).get()
        if driver_doc.exists:
            driver_data = driver_doc.to_dict()
            new_total = driver_data.get("points", 0) + int(points)

            db.collection("drivers").document(driver_id).update({
                "points": new_total,
                f"races.{race_ref.id}": int(points)
            })

            driver_results[driver_id] = int(points)
        else:
            print(f"Driver '{driver_id}' not found")

    # Save race with resolved driver IDs
    race_ref.set({
        "name": race_name,
        "date": race_date,
        "results": driver_results
    })

    # Recalculate team scores
    for team_doc in db.collection("teams").stream():
        team_data = team_doc.to_dict()
        total_score = 0
        for d_id in team_data.get("drivers", []):
            driver = db.collection("drivers").document(d_id).get().to_dict()
            total_score += driver.get("points", 0)
        db.collection("teams").document(team_doc.id).update({"score": total_score})

    return jsonify({"status": "Race recorded with driver IDs"}), 200

@app.route("/user/race_results/<race_id>")
def get_race_results(race_id):
    race_doc = db.collection("races").document(race_id).get()
    if not race_doc.exists:
        return jsonify({"error": "Race not found"}), 404

    race = race_doc.to_dict()
    all_drivers = {d.id: d.to_dict().get("name", "Unknown") for d in db.collection("drivers").stream()}

    #Combine driver names with points from this race
    results = []
    for driver_id, name in all_drivers.items():
        points = race.get("results", {}).get(driver_id, 0)
        results.append({ "name": name, "points": points })

    return jsonify({
        "race_name": race.get("name"),
        "date": race.get("date"),
        "results": results
    })

@app.route("/admin/data/leagues")
def get_leagues():
    leagues = []
    for doc in db.collection("leagues").stream():
        league = doc.to_dict()
        league["id"] = doc.id
        leagues.append(league)
    return jsonify(leagues)

@app.route("/admin/create_league", methods=["POST"])
def create_league():
    data = request.get_json()
    name = data.get("name")
    league_type = data.get("type", "public")
    team_filter = data.get("team_restriction") or None

    #Generate a unique code for private leagues
    code = None
    if league_type == "private":
        import random, string
        while True:
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            existing = db.collection("leagues").where("code", "==", code).get()
            if not existing:
                break

    league_data = {
        "name": name,
        "type": league_type,
        "team_restriction": team_filter,
        "created_by": "admin",
        "created_at": firestore.SERVER_TIMESTAMP
    }

    if code:
        league_data["code"] = code

    db.collection("leagues").add(league_data)
    return jsonify({ "status": "league created", "code": code })

@app.route("/user/create_league", methods=["POST"])
def create_league_user():
    uid = get_current_user_id()
    if not uid:
        return jsonify({ "error": "Unauthorized" }), 401

    data = request.get_json()
    name = data.get("name")
    league_type = data.get("type", "public")
    team_filter = data.get("team_restriction") or None

    #Generate a join code if private
    code = None
    if league_type == "private":
        import random, string
        while True:
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            existing = db.collection("leagues").where("code", "==", code).get()
            if not existing:
                break

    league_data = {
        "name": name,
        "type": league_type,
        "team_restriction": team_filter,
        "created_by": uid,
        "created_at": firestore.SERVER_TIMESTAMP
    }

    if code:
        league_data["code"] = code

    doc_ref = db.collection("leagues").add(league_data)
    league_id = doc_ref[1].id  #Newly created league doc ID

    #Auto-add user to league_memberships
    db.collection("league_memberships").add({
        "user_id": uid,
        "league_id": league_id,
        "joined_at": firestore.SERVER_TIMESTAMP,
        "team_id": None  #Updated manually
    })

    return jsonify({ "status": "league created", "code": code })

@app.route("/admin/update/leagues", methods=["POST", "PUT"])
def update_league():
    data = request.get_json()
    doc_id = data.get("id")
    league_type = data.get("type", "public")
    team_filter = data.get("team_restriction") or None

    #Generate join code if creating a new private league
    code = None
    if request.method == "POST" and league_type == "private":
        import random, string
        while True:
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            existing = db.collection("leagues").where("code", "==", code).get()
            if not existing:
                break

    league_data = {
        "name": data.get("name"),
        "type": league_type,
        "team_restriction": team_filter,
        "created_by": "admin",
        "created_at": firestore.SERVER_TIMESTAMP
    }

    if code:
        league_data["code"] = code

    if request.method == "PUT" and doc_id:
        db.collection("leagues").document(doc_id).set(league_data)
    else:
        db.collection("leagues").add(league_data)

    return jsonify({ "status": "success", "code": code }), 200

@app.route("/user/leagues/public")
def get_public_leagues():
    public = []
    for doc in db.collection("leagues").where("type", "==", "public").stream():
        league = doc.to_dict()
        league["id"] = doc.id
        public.append(league)
    return jsonify(public)

@app.route("/user/leagues/joined")
def get_joined_leagues():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Unauthorized"}), 401

    memberships = db.collection("league_memberships").where("user_id", "==", uid).stream()
    league_ids = [doc.to_dict().get("league_id") for doc in memberships]

    joined = []
    for lid in league_ids:
        doc = db.collection("leagues").document(lid).get()
        if doc.exists:
            league = doc.to_dict()
            league["id"] = doc.id
            joined.append(league)

    return jsonify(joined)

@app.route("/user/update_team_in_league", methods=["POST"])
def update_team_in_league():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    league_id = data.get("league_id")
    team_id = data.get("team_id")

    #Find membership record
    membership_docs = db.collection("league_memberships") \
        .where("user_id", "==", uid) \
        .where("league_id", "==", league_id).get()

    for doc in membership_docs:
        doc.reference.update({ "team_id": team_id })

    return jsonify({ "status": "team updated" })

@app.route("/user/leagues/<league_id>/standings")
def get_league_standings(league_id):
    members = db.collection("league_memberships") \
        .where("league_id", "==", league_id).stream()

    standings = []
    for m in members:
        mem = m.to_dict()
        team_id = mem.get("team_id")
        if not team_id:
            continue

        team_doc = db.collection("fantasy_teams").document(team_id).get()
        user_doc = db.collection("users").document(mem["user_id"]).get()

        if team_doc.exists:
            team = team_doc.to_dict()
            username = user_doc.to_dict().get("username") if user_doc.exists else mem["user_id"]

            standings.append({
                "user_id": mem["user_id"],
                "username": username,
                "team_name": team.get("name"),
                "points": team.get("points", 0)
            })

    standings.sort(key=lambda x: x["points"], reverse=True)
    return jsonify(standings)

@app.route("/user/leagues/<league_id>/info")
def get_league_info(league_id):
    doc = db.collection("leagues").document(league_id).get()
    if not doc.exists:
        return jsonify({"error": "League not found"}), 404
    league = doc.to_dict()
    league["id"] = doc.id
    return jsonify(league)

@app.route("/user/join_private_league", methods=["POST"])
def join_private_league():
    uid = get_current_user_id()
    if not uid:
        return jsonify({ "error": "Unauthorized" }), 401

    data = request.get_json()
    code = data.get("code")

    #Find league with matching code
    leagues = db.collection("leagues").where("code", "==", code).get()
    if not leagues:
        return jsonify({ "error": "Invalid code" }), 404

    league_doc = leagues[0]
    league_id = league_doc.id

    #Check if user is already a member
    existing = db.collection("league_memberships") \
        .where("user_id", "==", uid) \
        .where("league_id", "==", league_id).get()

    if existing:
        return jsonify({ "error": "Already joined" }), 400

    #Add membership
    db.collection("league_memberships").add({
        "user_id": uid,
        "league_id": league_id,
        "joined_at": firestore.SERVER_TIMESTAMP,
        "team_id": None
    })

    return jsonify({ "status": "joined" })

#Load fantasy team options within league
@app.route("/user/teams")
def get_user_teams():
    uid = get_current_user_id()
    if not uid:
        return jsonify({ "error": "Unauthorized" }), 401

    teams = []
    docs = db.collection("fantasy_teams").where("user_id", "==", uid).stream()

    for doc in docs:
        team = doc.to_dict()
        team["id"] = doc.id
        teams.append({
            "id": team["id"],
            "name": team.get("name"),
            "points": team.get("points", 0)
        })

    return jsonify(teams)

@app.route("/user/fantasy_teams", methods=["GET", "POST"])
def handle_fantasy_teams():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    if request.method == "GET":
        teams_ref = db.collection("fantasy_teams").where("user_id", "==", user_id).stream()
        teams = []

        #Fetch readable names
        drivers = {d.id: d.to_dict().get("name") for d in db.collection("drivers").stream()}
        team_map = {t.id: t.to_dict().get("name") for t in db.collection("teams").stream()}

        for doc in teams_ref:
            t = doc.to_dict()
            t["id"] = doc.id
            t["driver_names"] = [drivers.get(d_id, "Unknown") for d_id in t.get("drivers", [])]
            t["team_name"] = team_map.get(t.get("team"), "Unknown")
            teams.append(t)

        return jsonify(teams)

    else:
        data = request.get_json()
        name = data.get("name", "").strip()
        driver_ids = data.get("drivers", [])
        team_id = data.get("team")

        if len(driver_ids) != 5 or not team_id or not name:
            return jsonify({"error": "Missing or invalid selection"}), 400

        total_price = 0
        for d_id in driver_ids:
            doc = db.collection("drivers").document(d_id).get()
            total_price += doc.to_dict().get("price", 0)
        team_doc = db.collection("teams").document(team_id).get()
        total_price += team_doc.to_dict().get("price", 0)

        if total_price > 100_000_000:
            return jsonify({"error": "Budget exceeded"}), 400

        db.collection("fantasy_teams").add({
            "user_id": user_id,
            "name": name,
            "drivers": driver_ids,
            "team": team_id,
            "price": total_price,
            "points": 0
        })

        return jsonify({"status": "Fantasy team created successfully"}), 200
    
@app.route("/user/fantasy_teams/<team_id>", methods=["DELETE"])
def delete_fantasy_team(team_id):
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    doc_ref = db.collection("fantasy_teams").document(team_id).get()
    if not doc_ref.exists:
        return jsonify({"error": "Fantasy team not found"}), 404

    team_data = doc_ref.to_dict()
    if team_data.get("user_id") != user_id:
        return jsonify({"error": "Forbidden"}), 403

    db.collection("fantasy_teams").document(team_id).delete()
    return jsonify({"status": "Fantasy team deleted"}), 200
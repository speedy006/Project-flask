from flask import Flask, render_template, request, jsonify
import os
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

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
    return "<h2>Welcome, Admin</h2>"

@app.route("/user_dashboard")
def user_dashboard():
    return render_template("user_dashboard.html")

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
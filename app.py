from flask import Flask
import os
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

load_dotenv()
cred_path = os.getenv("FIREBASE_CREDENTIALS")
cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred)
db = firestore.client()

app = Flask(__name__)

@app.route("/")
def home():
  return "Project start"

@app.route("/test_db")
def test_db():
    users_ref = db.collection("users").limit(1).stream()
    users = [doc.to_dict() for doc in users_ref]
    return {"status": "success", "data": users or "No users found"}
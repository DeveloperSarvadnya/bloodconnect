import urllib.request
import json
from datetime import datetime, timedelta

SUPABASE_URL = "https://jzhrmozevbdrfprhaxzd.supabase.co/rest/v1"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6aHJtb3pldmJkcmZwcmhheHpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTIxMTEzOSwiZXhwIjoyMTA0Nzg3MTM5fQ.pp8ZvD9vBuqDZd9aNq5x6gEmLiv01ZooA8_dJH4y0u8"

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def post(endpoint, payload):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(f"{SUPABASE_URL}/{endpoint}", data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            res = json.loads(resp.read().decode())
            print(f"✅ Successfully inserted into {endpoint}: {len(res) if isinstance(res, list) else 1} rows")
            return res
    except urllib.error.HTTPError as e:
        print(f"❌ Error inserting into {endpoint}: {e.code} - {e.read().decode()}")
        return None

# 1. Blood Banks (6 realistic facilities around Chennai/SRM)
blood_banks_data = [
    {
        "name": "SRM Medical Centre & Blood Bank",
        "latitude": 12.8231,
        "longitude": 80.0442,
        "address": "SRM Nagar, Kattankulathur, Chengalpattu, Tamil Nadu 603203",
        "contact_number": "+91 44 4743 2345",
        "stock": {"A+": 18, "A-": 4, "B+": 24, "B-": 6, "O+": 32, "O-": 4, "AB+": 9, "AB-": 2}
    },
    {
        "name": "Apollo Specialty Hospitals Blood Bank",
        "latitude": 12.8398,
        "longitude": 80.0812,
        "address": "OMR Bypass Road, Chengalpattu, Tamil Nadu 603103",
        "contact_number": "+91 44 2829 0200",
        "stock": {"A+": 35, "A-": 11, "B+": 42, "B-": 8, "O+": 54, "O-": 9, "AB+": 14, "AB-": 4}
    },
    {
        "name": "Rotary Central TTK Blood Bank",
        "latitude": 13.0489,
        "longitude": 80.2425,
        "address": "130 Marshalls Road, Egmore, Chennai, Tamil Nadu 600008",
        "contact_number": "+91 44 2811 1111",
        "stock": {"A+": 26, "A-": 8, "B+": 31, "B-": 7, "O+": 40, "O-": 6, "AB+": 11, "AB-": 3}
    },
    {
        "name": "Indian Red Cross Society Blood Centre",
        "latitude": 13.0694,
        "longitude": 80.2581,
        "address": "50 Montieth Road, Egmore, Chennai, Tamil Nadu 600008",
        "contact_number": "+91 44 2855 4585",
        "stock": {"A+": 45, "A-": 12, "B+": 50, "B-": 10, "O+": 62, "O-": 8, "AB+": 18, "AB-": 5}
    },
    {
        "name": "Fortis Malar Hospital Blood Center",
        "latitude": 13.0067,
        "longitude": 80.2570,
        "address": "52 1st Main Road, Gandhi Nagar, Adyar, Chennai 600020",
        "contact_number": "+91 44 4289 2222",
        "stock": {"A+": 19, "A-": 5, "B+": 25, "B-": 4, "O+": 33, "O-": 4, "AB+": 7, "AB-": 2}
    },
    {
        "name": "MGM Healthcare Blood Bank",
        "latitude": 13.0732,
        "longitude": 80.2188,
        "address": "Nelson Manickam Road, Aminjikarai, Chennai 600029",
        "contact_number": "+91 44 4524 2424",
        "stock": {"A+": 22, "A-": 7, "B+": 28, "B-": 5, "O+": 36, "O-": 5, "AB+": 10, "AB-": 3}
    }
]

# 2. Upcoming Donation Camps (Dates in the next 1-4 weeks)
today = datetime.now()
camps_data = [
    {
        "name": "SRM Campus Mega Blood Drive 2026",
        "organizer": "SRM Youth Red Cross & NSS",
        "latitude": 12.8236,
        "longitude": 80.0450,
        "address": "Tech Park Auditorium, SRM Institute of Science and Technology, Kattankulathur",
        "camp_date": (today + timedelta(days=7)).strftime("%Y-%m-%d"),
        "start_time": "09:00:00",
        "end_time": "17:00:00",
        "description": "Annual voluntary student & faculty blood donation camp with on-site hemoglobin and blood group screening."
    },
    {
        "name": "Chennai IT Corridor LifeSaver Drive",
        "organizer": "Lions Club of Madras & Tech Parks",
        "latitude": 12.8480,
        "longitude": 80.0750,
        "address": "ELCOT Special Economic Zone, Sholinganallur, Chennai 600119",
        "camp_date": (today + timedelta(days=14)).strftime("%Y-%m-%d"),
        "start_time": "10:00:00",
        "end_time": "16:30:00",
        "description": "Corporate donor drive supporting trauma center emergency blood reserves across Chengalpattu."
    },
    {
        "name": "Rotary Community Blood Camp",
        "organizer": "Rotary Club of Madras Central",
        "latitude": 13.0382,
        "longitude": 80.2340,
        "address": "Sir Pitti Theagaraya Hall, G.N. Chetty Road, T. Nagar, Chennai 600017",
        "camp_date": (today + timedelta(days=21)).strftime("%Y-%m-%d"),
        "start_time": "08:30:00",
        "end_time": "14:00:00",
        "description": "Community outreach donation drive with special emphasis on rare O-negative and AB-negative donors."
    },
    {
        "name": "Tambaram Railway Hospital Camp",
        "organizer": "Southern Railway Medical Unit",
        "latitude": 12.9249,
        "longitude": 80.1250,
        "address": "Suburban Railway Ground, West Tambaram, Chennai 600045",
        "camp_date": (today + timedelta(days=28)).strftime("%Y-%m-%d"),
        "start_time": "09:30:00",
        "end_time": "15:30:00",
        "description": "Public life-saving drive dedicated to trauma emergency and dialysis patient support."
    }
]

# 3. Realistic Urgent Blood Requests
hospital_id = "fb14191d-f56d-401f-8e54-a8b226cae220" # SRM Global Hospital profile
requests_data = [
    {
        "hospital_id": hospital_id,
        "blood_group": "O-",
        "units_needed": 3,
        "urgency": "critical",
        "patient_condition": "Emergency Cardiac Bypass & Trauma Surgery",
        "latitude": 12.8160,
        "longitude": 80.0396,
        "address": "SRM Global Hospital, ICU Ward 3, Kattankulathur",
        "status": "open",
        "expires_at": (today + timedelta(days=2)).isoformat()
    },
    {
        "hospital_id": hospital_id,
        "blood_group": "B+",
        "units_needed": 2,
        "urgency": "high",
        "patient_condition": "Severe Anemia & Road Accident Trauma",
        "latitude": 12.8210,
        "longitude": 80.0425,
        "address": "Emergency Department, SRM Medical College Hospital",
        "status": "partially_fulfilled",
        "expires_at": (today + timedelta(days=3)).isoformat()
    },
    {
        "hospital_id": hospital_id,
        "blood_group": "AB-",
        "units_needed": 1,
        "urgency": "critical",
        "patient_condition": "Platelet Refractory Care & Leukemia Support",
        "latitude": 12.8350,
        "longitude": 80.0550,
        "address": "Hematology Department, Apollo Specialty Hospital",
        "status": "open",
        "expires_at": (today + timedelta(days=2)).isoformat()
    },
    {
        "hospital_id": hospital_id,
        "blood_group": "A+",
        "units_needed": 2,
        "urgency": "medium",
        "patient_condition": "Post-Chemotherapy Bone Marrow Support",
        "latitude": 12.8180,
        "longitude": 80.0380,
        "address": "General Surgery Ward B, SRM Hospital",
        "status": "open",
        "expires_at": (today + timedelta(days=4)).isoformat()
    },
    {
        "hospital_id": hospital_id,
        "blood_group": "O+",
        "units_needed": 4,
        "urgency": "high",
        "patient_condition": "High-Risk Maternity Delivery with Complications",
        "latitude": 12.9250,
        "longitude": 80.1200,
        "address": "Obstetrics Wing, Tambaram Govt Hospital",
        "status": "open",
        "expires_at": (today + timedelta(days=3)).isoformat()
    }
]

print("--- Seeding Synthetic Data ---")
inserted_banks = post("blood_banks", blood_banks_data)
inserted_camps = post("donation_camps", camps_data)
inserted_requests = post("blood_requests", requests_data)

# 4. Donor Pledges (Donation responses)
if inserted_requests and len(inserted_requests) > 0:
    donor_id_ajay = "5829994d-235b-4787-b98a-0cc6b7f45d76"
    donor_id_sanjay = "0e5414a6-e700-4c0b-beef-7aee0376c9db"
    
    pledges = [
        {
            "request_id": inserted_requests[0]["id"],
            "donor_id": donor_id_sanjay,
            "status": "pledged"
        },
        {
            "request_id": inserted_requests[1]["id"],
            "donor_id": donor_id_ajay,
            "status": "confirmed"
        }
    ]
    post("donation_responses", pledges)

print("\n🎉 Synthetic data generation finished successfully!")

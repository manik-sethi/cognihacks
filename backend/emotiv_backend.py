import json
import threading
import websocket
import random
import time

# === Configuration ===
USE_EMOTIV = False  # Set to True when you're ready to stream from the headset
CLIENT_ID = "zXsbdUwnp1JMphhbQ3iVITaRkiiBwymi9C8reb2m"
CLIENT_SECRET = "rz2hSZGQSt2ptFPHf2Y7mNkngKA00y5Z02rabviSDspeDe65JD786bFLCzx7knvx55kKcGtVTFBJw1tw19UDXHhX8TbU0OxWflblZnB8JABoJRDSvkWKJsTBeqOtHgw9"
HEADSET_ID = "INSIGHT-1234"  # Replace with your actual headset ID

# === Internal State ===
confusion_level = 67 # Default for debugging
sleep = 2
_auth_token = None
_session_id = None

# === Public API ===
def get_confusion_level():
    return confusion_level

# === Setting Global Variables within a loop === 
def set_confusion_level(value: int):
    global confusion_level
    confusion_level = max(0, min(100, value))  # Clamp between 0–100

# === Grab EEG data from Emotiv ===
# Andy & Aaron are handling this
def stream_confusion():
    while True:
        set_confusion_level(random.randint(20, 80))
        print("Simulated confusion level:", confusion_level)

        # Grab stuff: Confusion level, beta power, alpha power, etc...
        
        time.sleep(sleep)

def simulate_confusion():
    set_confusion_level(0)
    sleep = 1 # Assuming a value for sleep
    while True:
        # Check the current confusion level
        current_level = get_confusion_level()
        
        if current_level > 80:
            # If the value is above 80, it oscillates with a value of 3
            # It will add or subtract a random number between -3 and 3
            oscillation = random.randint(-3, 3)
            set_confusion_level(current_level + oscillation)
        elif current_level <= 75:
            # If the value is 75 or below, it increases by 5
            set_confusion_level(current_level + 5)
        else:
            # This handles the case where the value is between 76 and 80.
            # It will continue to increase by 5 until it goes above 80.
            set_confusion_level(current_level + 5)

        time.sleep(sleep)

# === Startup - Actual Function Calls ===
if not USE_EMOTIV:
    threading.Thread(target=simulate_confusion, daemon=True).start()
else:
    threading.Thread(target=stream_confusion, daemon=True).start()
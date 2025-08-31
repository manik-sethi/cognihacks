# CogniLearn - A neuro-aware screenshot tutor
Cognilearn is an AI tutor that uses BCI technology to automatically detect when you are confused. Once confusion is detected, CogniLearn screenshots the problem you are on, understands it, and then offers gentle guidance on our UI.

## 🧰 How we built it:
Here's how we built the project

### Website
We used lovable to generate a website, and then adjusted the code so it would work with our backend. Our backend is in python, and our frontend involves javascript .

### BCI tracking
In an ideal scenario, we'd use the Emotiv headset to track our confusion metrics and then directly stream it to our python backend. From there, we'd do any type of processing required and then pass it to our frontend.

### Chrome Extension
In order to screenshot, we built a chrome extension to take care of that. If our confusion value passed the threshold, then the extension would activate and take a screenshot of the current tab.

## 🚀 Getting Started
### Prereqs
* Use node
* OpenAI API key
### Install and Run (Frontend)
```
npm run dev
```

### Python Backend
```
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r ..requirements.txt
python -m uvicorn main:app --reload
```
Keep in mind that you need to restart the backend if you want the confusion value to reset from 0, otherwise it oscilliates around 80, which is higher than our threshold of 65.

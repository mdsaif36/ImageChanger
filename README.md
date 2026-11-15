# Chromify Museum Dark

Single-service deployment for Railway. The Dockerfile builds the React + Vite
frontend and runs it together with the Flask + OpenCV API.

## Deploy on Railway

1. Push this repository structure to GitHub.
2. In Railway, create a project and deploy the GitHub repository.
3. Leave the service root directory as `/` (repository root).
4. Railway will detect the root `Dockerfile` and build the frontend and backend
   into one web service.
5. Railway assigns the `PORT` environment variable automatically.

## Required AI model files

Put these three pretrained files inside `models/` before deployment:

- `colorization_deploy_v2.prototxt`
- `colorization_release_v2.caffemodel`
- `pts_in_hull.npy`

The source ZIP supplied for this preparation did not contain these model weights.
The app can start without them, but `/api/health` will report `model_files_missing`
and colorization will not work until they are added.

## Local development

Frontend:
```bash
cd frontend
npm install
npm run dev
```

Backend (in a second terminal):
```bash
pip install -r requirements.txt
python app.py
```

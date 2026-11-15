from pathlib import Path
import os
import cv2
import numpy as np
from flask import Flask, request, jsonify, send_file
from io import BytesIO

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
MODEL_DIR = BASE_DIR / "models"

PROTO_PATH = MODEL_DIR / "colorization_deploy_v2.prototxt"
MODEL_PATH = MODEL_DIR / "colorization_release_v2.caffemodel"
POINTS_PATH = MODEL_DIR / "pts_in_hull.npy"

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

_net = None
_points = None

def load_model():
    global _net, _points
    if _net is not None:
        return _net, _points

    missing = [str(p) for p in (PROTO_PATH, MODEL_PATH, POINTS_PATH) if not p.is_file()]
    if missing:
        raise FileNotFoundError(
            "Missing colorization model file(s): " + ", ".join(missing) +
            ". See README.md for the required locations."
        )

    points = np.load(str(POINTS_PATH))
    points = points.transpose().reshape(2, 313, 1, 1).astype(np.float32)
    net = cv2.dnn.readNetFromCaffe(str(PROTO_PATH), str(MODEL_PATH))
    net.getLayer(net.getLayerId("class8_ab")).blobs = [points]
    net.getLayer(net.getLayerId("conv8_313_rh")).blobs = [
        np.full((1, 313), 2.606, dtype=np.float32)
    ]
    _net, _points = net, points
    return _net, _points

def colorize_bytes(raw_bytes):
    image_array = np.frombuffer(raw_bytes, dtype=np.uint8)
    frame = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("The uploaded file is not a valid image.")

    net, _ = load_model()
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l_channel = lab[:, :, 0]

    resized_l = cv2.resize(l_channel, (224, 224))
    resized_l -= 50
    net.setInput(cv2.dnn.blobFromImage(resized_l))
    ab = net.forward()[0, :, :, :].transpose((1, 2, 0))
    ab = cv2.resize(ab, (frame.shape[1], frame.shape[0]))

    output_lab = np.concatenate((l_channel[:, :, None], ab), axis=2)
    output_bgr = np.clip(cv2.cvtColor(output_lab, cv2.COLOR_LAB2BGR), 0, 1)
    ok, encoded = cv2.imencode(".png", (output_bgr * 255).astype(np.uint8))
    if not ok:
        raise RuntimeError("Could not encode the colorized image.")
    return encoded.tobytes()

@app.get("/api/health")
def health():
    missing = [p.name for p in (PROTO_PATH, MODEL_PATH, POINTS_PATH) if not p.is_file()]
    return jsonify({
        "status": "ok" if not missing else "model_files_missing",
        "missing_files": missing
    }), (200 if not missing else 503)

@app.post("/api/colorize")
def colorize():
    if "image" not in request.files:
        return jsonify({"error": "Please choose an image to colorize."}), 400
    uploaded = request.files["image"]
    if not uploaded.filename:
        return jsonify({"error": "No image selected."}), 400
    allowed = {".png", ".jpg", ".jpeg", ".bmp", ".webp"}
    suffix = Path(uploaded.filename).suffix.lower()
    if suffix not in allowed:
        return jsonify({"error": "Supported formats: PNG, JPG, JPEG, BMP and WEBP."}), 400

    try:
        result = colorize_bytes(uploaded.read())
        return send_file(
            BytesIO(result),
            mimetype="image/png",
            as_attachment=False,
            download_name="colorized.png"
        )
    except FileNotFoundError as exc:
        return jsonify({"error": str(exc)}), 503
    except (ValueError, cv2.error) as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception:
        app.logger.exception("Unexpected colorization error")
        return jsonify({"error": "Colorization failed. Check the backend terminal for details."}), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)

# app/__init__.py
import sys
from pathlib import Path
from flask import Flask, render_template
from .blueprints.auth_bp import bp as auth_bp
from .blueprints.validate_bp import bp as validate_bp
from .blueprints.jobs_bp import bp as jobs_bp

def _resource_root() -> Path:
    # Quando empacotado (onedir ou onefile), PyInstaller define sys._MEIPASS
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)
    # ambiente de dev
    return Path(__file__).resolve().parent

def create_app():
    root = _resource_root()
    app = Flask(
        __name__,
        template_folder=str(root / "templates"),
        static_folder=str(root / "static"),
        static_url_path="/static",
    )

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(validate_bp)
    app.register_blueprint(jobs_bp)

    @app.get("/")
    def home():
        return render_template("index.html")

    return app

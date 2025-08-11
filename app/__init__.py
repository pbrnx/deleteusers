from flask import Flask, render_template
from .blueprints.auth_bp import bp as auth_bp
from .blueprints.validate_bp import bp as validate_bp
from .blueprints.jobs_bp import bp as jobs_bp

def create_app():
    app = Flask(__name__, static_folder="static", template_folder="templates")
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(validate_bp)
    app.register_blueprint(jobs_bp)

    @app.get("/")
    def home():
        return render_template("index.html")

    return app

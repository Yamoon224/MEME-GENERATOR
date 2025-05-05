import base64
import io
import os
import uuid
from datetime import datetime

import requests
from PIL import Image, ImageDraw, ImageFont
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configuration de la base de données SQLite
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///memes.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)


# Modèle pour les mèmes
class Meme(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    path = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now())

    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'path': self.path,
            'created_at': self.created_at.strftime("%Y-%m-%d %H:%M:%S")
        }


# Configuration des dossiers
UPLOAD_FOLDER = 'static/uploads'
SAVED_MEMES_FOLDER = 'static/memes'
FONTS_FOLDER = 'static/fonts'

# Créer les dossiers s'ils n'existent pas
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(SAVED_MEMES_FOLDER, exist_ok=True)
os.makedirs(FONTS_FOLDER, exist_ok=True)

# Télécharger la police Impact si elle n'existe pas
IMPACT_FONT_PATH = os.path.join(FONTS_FOLDER, 'impact.ttf')
if not os.path.exists(IMPACT_FONT_PATH):
    try:
        # URL d'une police Impact libre de droits
        font_url = "https://github.com/google/fonts/raw/main/apache/roboto/static/Roboto-Bold.ttf"
        response = requests.get(font_url)
        with open(IMPACT_FONT_PATH, 'wb') as f:
            f.write(response.content)
        print(f"Police Impact téléchargée avec succès dans {IMPACT_FONT_PATH}")
    except Exception as e:
        print(f"Erreur lors du téléchargement de la police Impact: {e}")

# Créer les tables de la base de données
with app.app_context():
    db.create_all()


@app.route('/')
def index():
    """Page d'accueil"""
    return render_template('index.html')


@app.route('/reset', methods=['POST'])
def reset():
    """Réinitialise l'état de l'application"""
    try:
        # Supprimer tous les fichiers du dossier uploads (sauf .gitkeep)
        for filename in os.listdir(UPLOAD_FOLDER):
            if filename != '.gitkeep':
                file_path = os.path.join(UPLOAD_FOLDER, filename)
                if os.path.isfile(file_path):
                    os.unlink(file_path)

        return jsonify({'success': True})
    except Exception as ex:
        app.logger.error(f"Erreur lors de la réinitialisation: {ex}")
        return jsonify({'success': False, 'error': str(ex)}), 500


@app.route('/upload', methods=['POST'])
def upload_image():
    """Gère l'upload d'une image"""
    if 'image' not in request.files:
        return jsonify({'error': 'Aucune image fournie'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'Aucune image sélectionnée'}), 400

    try:
        # Vérifier le type de fichier
        if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
            return jsonify({'error': 'Format de fichier non supporté. Utilisez PNG, JPG ou GIF.'}), 400

        # Vérifier la taille du fichier (max 10 Mo)
        if len(file.read()) > 10 * 1024 * 1024:  # 10MB en octets
            return jsonify({'error': 'Fichier trop volumineux (max 10MB)'}), 400

        # Réinitialiser le curseur du fichier
        file.seek(0)

        # Générer un nom de fichier unique
        original_filename = secure_filename(file.filename)
        filename = f"{uuid.uuid4()}_{original_filename}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)

        # Sauvegarder le fichier
        file.save(filepath)

        # Vérifier que c'est bien une image valide
        try:
            with Image.open(filepath) as img:
                # Tout va bien, c'est une image valide
                width, height = img.size
                app.logger.info(f"Image uploadée: {filename} ({width}x{height})")
        except Exception:
            # Pas une image valide, supprimer le fichier
            os.remove(filepath)
            return jsonify({'error': 'Fichier non valide. Veuillez uploader une image.'}), 400

        return jsonify({
            'success': True,
            'filename': filename,
            'filepath': filepath,
            'dimensions': {'width': width, 'height': height}
        })

    except Exception as ex:
        app.logger.error(f"Erreur lors de l'upload: {ex}")
        return jsonify({'error': f"Une erreur s'est produite: {str(ex)}"}), 500


@app.route('/generate-meme', methods=['POST'])
def generate_meme():
    data = request.json

    # Récupérer les paramètres
    image_path = os.path.join(UPLOAD_FOLDER, data['filename'])
    top_text = data.get('topText', '')
    bottom_text = data.get('bottomText', '')
    top_font_size = int(data.get('topFontSize', 40))
    bottom_font_size = int(data.get('bottomFontSize', 40))
    top_text_color = data.get('topTextColor', '#ffffff')
    bottom_text_color = data.get('bottomTextColor', '#ffffff')

    # Convertir les couleurs hexadécimales en RGB
    def hex_to_rgb(hex_color):
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i + 2], 16) for i in (0, 2, 4))

    top_color_rgb = hex_to_rgb(top_text_color)
    bottom_color_rgb = hex_to_rgb(bottom_text_color)

    # Ouvrir l'image
    try:
        img = Image.open(image_path)

        # Créer un objet de dessin
        draw = ImageDraw.Draw(img)

        # Charger la police
        try:
            # Essayer de charger Impact depuis notre dossier de polices
            top_font = ImageFont.truetype(IMPACT_FONT_PATH, top_font_size)
            bottom_font = ImageFont.truetype(IMPACT_FONT_PATH, bottom_font_size)
        except IOError:
            # Fallback sur une police système
            top_font = ImageFont.truetype("arial.ttf", top_font_size)
            bottom_font = ImageFont.truetype("arial.ttf", bottom_font_size)

        # Ajouter le texte du haut
        if top_text:
            # Calculer la position du texte
            text_width = draw.textlength(top_text, font=top_font)
            position = ((img.width - text_width) / 2, top_font_size / 2)

            # Ajouter un contour noir pour la lisibilité
            for offset in [(1, 1), (-1, 1), (1, -1), (-1, -1), (2, 2), (-2, 2), (2, -2), (-2, -2)]:
                draw.text((position[0] + offset[0], position[1] + offset[1]),
                          top_text, font=top_font, fill=(0, 0, 0))

            # Ajouter le texte principal
            draw.text(position, top_text, font=top_font, fill=top_color_rgb)

        # Ajouter le texte du bas
        if bottom_text:
            # Calculer la position du texte
            text_width = draw.textlength(bottom_text, font=bottom_font)
            position = ((img.width - text_width) / 2, img.height - bottom_font_size * 1.5)

            # Ajouter un contour noir pour la lisibilité
            for offset in [(1, 1), (-1, 1), (1, -1), (-1, -1), (2, 2), (-2, 2), (2, -2), (-2, -2)]:
                draw.text((position[0] + offset[0], position[1] + offset[1]),
                          bottom_text, font=bottom_font, fill=(0, 0, 0))

            # Ajouter le texte principal
            draw.text(position, bottom_text, font=bottom_font, fill=bottom_color_rgb)

        # Sauvegarder l'image en mémoire
        img_io = io.BytesIO()
        img.save(img_io, 'PNG')
        img_io.seek(0)

        # Convertir en base64 pour l'affichage
        img_base64 = base64.b64encode(img_io.getvalue()).decode('utf-8')

        return jsonify({
            'success': True,
            'image': f'data:image/png;base64,{img_base64}'
        })

    except Exception as ex:
        return jsonify({'error': str(ex)}), 500


@app.route('/save-meme', methods=['POST'])
def save_meme():
    """Sauvegarde un mème dans la galerie"""
    data = request.json
    image_data = data['imageData'].split(',')[1]  # Enlever le préfixe data:image/png;base64,

    # Générer un nom de fichier unique
    filename = f"meme_{uuid.uuid4()}.png"
    filepath = os.path.join(SAVED_MEMES_FOLDER, filename)

    # Décoder et sauvegarder l'image
    with open(filepath, "wb") as fs:
        fs.write(base64.b64decode(image_data))

    # Créer un nouvel enregistrement dans la base de données
    meme_id = str(uuid.uuid4())
    meme = Meme(
        id=meme_id,
        filename=filename,
        path=f'/static/memes/{filename}'
    )

    db.session.add(meme)
    db.session.commit()

    return jsonify({'success': True, 'meme': meme.to_dict()})


@app.route('/delete-meme/<meme_id>', methods=['DELETE'])
def delete_meme(meme_id):
    """Supprime un mème de la galerie"""
    # Trouver le mème dans la base de données
    meme = Meme.query.get(meme_id)

    if meme:
        # Supprimer le fichier
        try:
            os.remove(os.path.join(SAVED_MEMES_FOLDER, meme.filename))
        except Exception as ex:
            print(f"Erreur lors de la suppression du fichier: {ex}")

        # Supprimer de la base de données
        db.session.delete(meme)
        db.session.commit()

        return jsonify({'success': True})

    return jsonify({'error': 'Meme not found'}), 404


@app.route('/saved-memes', methods=['GET'])
def get_saved_memes():
    """Récupère tous les mèmes sauvegardés"""
    memes = Meme.query.order_by(Meme.created_at.desc()).all()
    return jsonify({
        'success': True,
        'memes': [meme.to_dict() for meme in memes]
    })


if __name__ == '__main__':
    app.run(debug=True)

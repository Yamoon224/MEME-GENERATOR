# Générateur de Mèmes en Ligne

## 📝 Description

 Il s'agit d'un générateur de mèmes en ligne simple, développé en Python avec Flask. 
 Cette application web permet aux utilisateurs de télécharger des images, d'ajouter du texte
 personnalisé et de créer rapidement des mèmes de qualité. Les utilisateurs peuvent prévisualiser
 leurs créations en temps réel, les télécharger, les partager sur les réseaux sociaux et les sauvegarder
 dans une galerie personnelle. 

## ✨ Fonctionnalités

- **Téléchargement d'images** : Importez des images depuis votre ordinateur (formats JPG, PNG, GIF)
- **Personnalisation de texte** :
  - Ajoutez du texte en haut et en bas de l'image
  - Modifiez la taille de police
  - Changez la couleur du texte
- **Prévisualisation en temps réel** : Visualisez instantanément les modifications apportées
- **Téléchargement et partage** : Enregistrez vos créations ou partagez-les directement sur les réseaux sociaux
- **Galerie de mèmes** : Consultez et gérez vos mèmes précédemment créés
- **Interface responsive** : Fonctionne sur ordinateurs, tablettes et smartphones
- **Mode sombre** : Easter egg caché pour activer un mode sombre (cliquez sur le texte en bas de page)

## 🛠️ Technologies utilisées

- **Backend** :
  - Python 3.8+
  - Flask (framework web)
  - SQLite (base de données)
  - Pillow (manipulation d'images)
  - Flask-SQLAlchemy (ORM)
  
- **Frontend** :
  - HTML5 / CSS3
  - JavaScript (ES6+)
  - Tailwind CSS (framework CSS)
  - Web Share API (pour le partage)

## 📋 Prérequis

- Python 3.8 ou supérieur
- pip (gestionnaire de paquets Python)
- Un navigateur web moderne (Chrome, Firefox, Safari, Edge)

## 🚀 Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/Kouagou/memegenerator.git
cd memgenerator
```
### 2. Créer un environnement virtuel

```bash
# Sur Windows
python -m venv venv
venv\Scripts\activate

# Sur macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Installer les dépendances

```bash
pip install -r requirements.txt
```

### 4. Configurer l'application

L'application crée automatiquement les dossiers nécessaires pour stocker les images téléchargées et les mèmes générés.
La base de données SQLite sera automatiquement créée également au premier démarrage de l'application.

### 5. Démarrer le serveur de développement

```bash
# Sur Windows
python app.py

# Sur macOS/Linux
python3 app.py
```

L'application est maintenant accessible à l'adresse [http:// localhost:5000](http://localhost:5000).

# MEME-GENERATOR

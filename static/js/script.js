// Attendre que le DOM soit chargé
document.addEventListener("DOMContentLoaded", () => {
  // Initialisation
  initApp()
})

/**
 * Initialise l'application
 */
function initApp() {
  // Éléments DOM - regroupés par fonctionnalité
  const elements = {
    // Upload et prévisualisation
    imageUpload: document.getElementById("image-upload"),
    chooseImageBtn: document.getElementById("choose-image-btn"),
    emptyState: document.getElementById("empty-state"),
    memePreview: document.getElementById("meme-preview"),
    memeImage: document.getElementById("meme-image"),
    loadingIndicator: document.getElementById("loading-indicator"),
    resetBtn: document.getElementById("reset-btn"),

    // Texte et style
    topText: document.getElementById("top-text"),
    bottomText: document.getElementById("bottom-text"),
    topFontSize: document.getElementById("top-font-size"),
    bottomFontSize: document.getElementById("bottom-font-size"),
    topFontSizeValue: document.getElementById("top-font-size-value"),
    bottomFontSizeValue: document.getElementById("bottom-font-size-value"),
    topTextColor: document.getElementById("top-text-color"),
    bottomTextColor: document.getElementById("bottom-text-color"),
    topColorPreview: document.getElementById("top-color-preview"),
    bottomColorPreview: document.getElementById("bottom-color-preview"),

    // Actions
    downloadBtn: document.getElementById("download-btn"),
    shareBtn: document.getElementById("share-btn"),
    saveBtn: document.getElementById("save-btn"),

    // Navigation
    editorTab: document.getElementById("editor-tab"),
    galleryTab: document.getElementById("gallery-tab"),
    editorContent: document.getElementById("editor-content"),
    galleryContent: document.getElementById("gallery-content"),

    // Galerie
    emptyGallery: document.getElementById("empty-gallery"),
    galleryGrid: document.getElementById("gallery-grid"),
  }

  // Variables d'état
  const state = {
    currentImageFilename: null,
    currentMemeDataUrl: null,
    savedMemes: [],
    isGenerating: false,
    lastUpdateTime: 0, // Pour limiter les mises à jour trop fréquentes
    updateDebounceTimeout: null,
    konamiActivated: false,
  }

  // Charger les mèmes sauvegardés
  loadSavedMemes()

  // Gestionnaires d'événements - regroupés par fonctionnalité

  // 1. Upload et prévisualisation
  elements.imageUpload.addEventListener("change", handleImageUpload)
  elements.chooseImageBtn.addEventListener("click", () => elements.imageUpload.click())
  elements.resetBtn.addEventListener("click", resetAll)

  // 2. Texte et style
  elements.topText.addEventListener("input", debounceUpdateMemePreview)
  elements.bottomText.addEventListener("input", debounceUpdateMemePreview)

  elements.topFontSize.addEventListener("input", function () {
    elements.topFontSizeValue.textContent = `${this.value}px`
    debounceUpdateMemePreview()
  })

  elements.bottomFontSize.addEventListener("input", function () {
    elements.bottomFontSizeValue.textContent = `${this.value}px`
    debounceUpdateMemePreview()
  })

  elements.topTextColor.addEventListener("input", function () {
    elements.topColorPreview.style.backgroundColor = this.value
    debounceUpdateMemePreview()
  })

  elements.bottomTextColor.addEventListener("input", function () {
    elements.bottomColorPreview.style.backgroundColor = this.value
    debounceUpdateMemePreview()
  })

  // 3. Actions
  elements.downloadBtn.addEventListener("click", downloadMeme)
  elements.shareBtn.addEventListener("click", shareMeme)
  elements.saveBtn.addEventListener("click", saveMeme)

  // 4. Navigation
  elements.editorTab.addEventListener("click", () => showTab("editor"))
  elements.galleryTab.addEventListener("click", () => showTab("gallery"))

  /**
   * Gère l'upload d'une image
   */
  function handleImageUpload(event) {
    const file = event.target.files[0]
    if (!file) return

    // Vérifier le type de fichier
    const validTypes = ["image/jpeg", "image/png", "image/gif"]
    if (!validTypes.includes(file.type)) {
      showError("Format de fichier non supporté. Utilisez JPG, PNG ou GIF.")
      return
    }

    // Vérifier la taille du fichier (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showError("Fichier trop volumineux (max 10MB)")
      return
    }

    // Afficher l'indicateur de chargement
    elements.loadingIndicator.classList.remove("hidden")
    elements.memePreview.classList.remove("hidden")
    elements.emptyState.classList.add("hidden")

    const formData = new FormData()
    formData.append("image", file)

    fetch("/upload", {
      method: "POST",
      body: formData,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`)
        }
        return response.json()
      })
      .then((data) => {
        if (data.success) {
          state.currentImageFilename = data.filename
          elements.memeImage.src = `/static/uploads/${data.filename}`
          elements.memeImage.onload = () => {
            elements.loadingIndicator.classList.add("hidden")
            enableButtons()
            updateMemePreview()

            // Animation de succès
            elements.memePreview.classList.add("fade-in")
            setTimeout(() => elements.memePreview.classList.remove("fade-in"), 500)
          }
        } else {
          throw new Error(data.error || "Erreur lors du téléchargement de l'image")
        }
      })
      .catch((error) => {
        console.error("Error:", error)
        showError(error.message || "Erreur de connexion au serveur")
        elements.loadingIndicator.classList.add("hidden")
        elements.memePreview.classList.add("hidden")
        elements.emptyState.classList.remove("hidden")
      })
  }

  /**
   * Limite les mises à jour trop fréquentes
   */
  function debounceUpdateMemePreview() {
    // Annuler le timeout précédent s'il existe
    if (state.updateDebounceTimeout) {
      clearTimeout(state.updateDebounceTimeout)
    }

    // Définir un nouveau timeout
    state.updateDebounceTimeout = setTimeout(() => {
      updateMemePreview()
    }, 300) // 300ms de délai
  }

  /**
   * Met à jour la prévisualisation du mème
   */
  function updateMemePreview() {
    if (!state.currentImageFilename || state.isGenerating) return

    // Éviter les mises à jour trop fréquentes
    const now = Date.now()
    if (now - state.lastUpdateTime < 100) return // Limiter à 10 mises à jour par seconde
    state.lastUpdateTime = now

    state.isGenerating = true
    elements.loadingIndicator.classList.remove("hidden")

    const data = {
      filename: state.currentImageFilename,
      topText: elements.topText.value,
      bottomText: elements.bottomText.value,
      topFontSize: elements.topFontSize.value,
      bottomFontSize: elements.bottomFontSize.value,
      topTextColor: elements.topTextColor.value,
      bottomTextColor: elements.bottomTextColor.value,
    }

    fetch("/generate-meme", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`)
        }
        return response.json()
      })
      .then((data) => {
        if (data.success) {
          elements.memeImage.src = data.image
          state.currentMemeDataUrl = data.image

          elements.memeImage.onload = () => {
            elements.loadingIndicator.classList.add("hidden")
            state.isGenerating = false

            // Ajouter une animation de fade-in
            elements.memeImage.classList.add("fade-in")
            setTimeout(() => elements.memeImage.classList.remove("fade-in"), 500)
          }
        } else {
          throw new Error(data.error || "Erreur lors de la génération du mème")
        }
      })
      .catch((error) => {
        console.error("Error:", error)
        showError(error.message || "Erreur de connexion au serveur")
        elements.loadingIndicator.classList.add("hidden")
        state.isGenerating = false
      })
  }

  /**
   * Réinitialise tous les paramètres
   */
  function resetAll() {
    // Demander confirmation
    if (!confirm("Êtes-vous sûr de vouloir tout réinitialiser ? Cette action effacera l'image et tous les textes.")) {
      return
    }

    // Réinitialiser les champs de texte
    elements.topText.value = ""
    elements.bottomText.value = ""

    // Réinitialiser les tailles de police
    elements.topFontSize.value = 40
    elements.bottomFontSize.value = 40
    elements.topFontSizeValue.textContent = "40px"
    elements.bottomFontSizeValue.textContent = "40px"

    // Réinitialiser les couleurs
    elements.topTextColor.value = "#ffffff"
    elements.bottomTextColor.value = "#ffffff"
    elements.topColorPreview.style.backgroundColor = "#ffffff"
    elements.bottomColorPreview.style.backgroundColor = "#ffffff"

    // Réinitialiser l'image
    if (state.currentImageFilename) {
      fetch("/reset", {
        method: "POST",
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            // Réinitialiser les variables d'état
            state.currentImageFilename = null
            state.currentMemeDataUrl = null

            // Réinitialiser l'interface
            elements.memePreview.classList.add("hidden")
            elements.emptyState.classList.remove("hidden")

            // Désactiver les boutons
            disableButtons()

            // Afficher un message de succès
            showMessage("Tout a été réinitialisé avec succès!")
          }
        })
        .catch((error) => {
          console.error("Error:", error)
          showError("Erreur lors de la réinitialisation")
        })
    } else {
      showMessage("Tout a été réinitialisé avec succès!")
    }
  }

  /**
   * Télécharge le mème actuel
   */
  function downloadMeme() {
    if (!state.currentMemeDataUrl) return

    // Créer un nom de fichier avec la date
    const date = new Date()
    const timestamp = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}_${date.getHours().toString().padStart(2, "0")}${date.getMinutes().toString().padStart(2, "0")}`
    const filename = `meme_${timestamp}.png`

    const link = document.createElement("a")
    link.href = state.currentMemeDataUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Animation de feedback
    elements.downloadBtn.classList.add("bg-green-600")
    elements.downloadBtn.classList.add("text-white")
    setTimeout(() => {
      elements.downloadBtn.classList.remove("bg-green-600")
      elements.downloadBtn.classList.remove("text-white")
    }, 500)

    // Afficher un message
    showMessage("Mème téléchargé avec succès!")
  }

  /**
   * Partage le mème actuel
   */
  function shareMeme() {
    if (!state.currentMemeDataUrl) return

    if (navigator.share) {
      fetch(state.currentMemeDataUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], "meme.png", { type: "image/png" })
          navigator
            .share({
              title: "Mon mème",
              text: "Regarde ce mème que j'ai créé!",
              files: [file],
            })
            .then(() => {
              console.log("Mème partagé avec succès")
              showMessage("Mème partagé avec succès!")
            })
            .catch((error) => {
              console.error("Erreur de partage:", error)
              // L'utilisateur a peut-être annulé le partage, pas d'erreur à afficher
            })
        })
        .catch((error) => {
          console.error("Erreur lors de la préparation du partage:", error)
          showError("Erreur lors de la préparation du partage")
        })
    } else {
      // Fallback pour les navigateurs qui ne supportent pas l'API Web Share
      showMessage(
        "Le partage n'est pas pris en charge par votre navigateur. Vous pouvez télécharger le mème et le partager manuellement.",
        "warning",
      )
    }
  }

  /**
   * Sauvegarde le mème dans la galerie
   */
  function saveMeme() {
    if (!state.currentMemeDataUrl) return

    elements.loadingIndicator.classList.remove("hidden")

    fetch("/save-meme", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageData: state.currentMemeDataUrl,
        topText: elements.topText.value,
        bottomText: elements.bottomText.value,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          state.savedMemes.unshift(data.meme) // Ajouter au début du tableau
          updateGallery()

          // Animation de feedback
          elements.saveBtn.classList.add("bg-green-600")
          elements.saveBtn.classList.add("text-white")
          setTimeout(() => {
            elements.saveBtn.classList.remove("bg-green-600")
            elements.saveBtn.classList.remove("text-white")
          }, 500)

          // Afficher un message de succès
          showMessage("Mème sauvegardé avec succès!")

          // Basculer vers l'onglet galerie
          showTab("gallery")
        } else {
          throw new Error(data.error || "Erreur lors de la sauvegarde du mème")
        }
      })
      .catch((error) => {
        console.error("Error:", error)
        showError(error.message || "Erreur de connexion au serveur")
      })
      .finally(() => {
        elements.loadingIndicator.classList.add("hidden")
      })
  }

  /**
   * Charge les mèmes sauvegardés depuis le serveur
   */
  function loadSavedMemes() {
    fetch("/saved-memes")
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          state.savedMemes = data.memes
          updateGallery()
        } else {
          throw new Error(data.error || "Erreur lors du chargement des mèmes")
        }
      })
      .catch((error) => {
        console.error("Error loading saved memes:", error)
        showError("Impossible de charger la galerie. Veuillez réessayer plus tard.")
      })
  }

  /**
   * Met à jour l'affichage de la galerie
   */
  function updateGallery() {
    if (state.savedMemes.length === 0) {
      elements.emptyGallery.classList.remove("hidden")
      elements.galleryGrid.classList.add("hidden")
      return
    }

    elements.emptyGallery.classList.add("hidden")
    elements.galleryGrid.classList.remove("hidden")
    elements.galleryGrid.innerHTML = ""

    // Créer les cartes de mèmes
    state.savedMemes.forEach((meme, index) => {
      const memeCard = document.createElement("div")
      memeCard.className = "meme-card slide-in"

      // Ajouter un délai pour l'animation
      memeCard.style.animationDelay = `${index * 0.05}s`

      memeCard.innerHTML = `
                <div class="relative">
                    <img src="${meme.path}" alt="Mème sauvegardé" class="w-full h-auto">
                    <div class="absolute inset-0 bg-black/0 hover:bg-black/40 transition-all duration-300"></div>
                    <div class="meme-actions">
                        <button class="download-saved-meme-btn action-btn bg-download" data-path="${meme.path}" title="Télécharger">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                        </button>
                        <button class="share-saved-meme-btn action-btn bg-share" data-path="${meme.path}" title="Partager">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="18" cy="5" r="3"></circle>
                                <circle cx="6" cy="12" r="3"></circle>
                                <circle cx="18" cy="19" r="3"></circle>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                            </svg>
                        </button>
                        <button class="delete-meme-btn action-btn bg-delete" data-id="${meme.id}" title="Supprimer">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="p-4 flex justify-between items-center">
                    <span class="text-xs text-meme-gray">${meme.created_at}</span>
                    ${
                      meme.views
                        ? `<span class="text-xs text-meme-gray flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        ${meme.views}
                    </span>`
                        : ""
                    }
                </div>
            `

      elements.galleryGrid.appendChild(memeCard)
    })

    // Ajouter les gestionnaires d'événements pour les boutons
    document.querySelectorAll(".delete-meme-btn").forEach((button) => {
      button.addEventListener("click", function () {
        const memeId = this.getAttribute("data-id")
        deleteMeme(memeId)
      })
    })

    document.querySelectorAll(".download-saved-meme-btn").forEach((button) => {
      button.addEventListener("click", function () {
        const memePath = this.getAttribute("data-path")
        downloadSavedMeme(memePath)
      })
    })

    document.querySelectorAll(".share-saved-meme-btn").forEach((button) => {
      button.addEventListener("click", function () {
        const memePath = this.getAttribute("data-path")
        shareSavedMeme(memePath)
      })
    })
  }

  /**
   * Supprime un mème de la galerie
   */
  function deleteMeme(memeId) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce mème?")) return

    fetch(`/delete-meme/${memeId}`, {
      method: "DELETE",
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          // Mettre à jour l'état local
          state.savedMemes = state.savedMemes.filter((meme) => meme.id !== memeId)
          updateGallery()
          showMessage("Mème supprimé avec succès!")
        } else {
          throw new Error(data.error || "Erreur lors de la suppression du mème")
        }
      })
      .catch((error) => {
        console.error("Error:", error)
        showError(error.message || "Erreur de connexion au serveur")
      })
  }

  /**
   * Télécharge un mème sauvegardé
   */
  function downloadSavedMeme(memePath) {
    const filename = memePath.split("/").pop()
    const link = document.createElement("a")
    link.href = memePath
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Afficher un message
    showMessage("Mème téléchargé avec succès!")
  }

  /**
   * Partage un mème sauvegardé
   */
  function shareSavedMeme(memePath) {
    if (navigator.share) {
      fetch(memePath)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], "meme.png", { type: "image/png" })
          navigator
            .share({
              title: "Mon mème",
              text: "Regarde ce mème que j'ai créé!",
              files: [file],
            })
            .then(() => console.log("Mème partagé avec succès"))
            .catch((error) => console.error("Erreur de partage:", error))
        })
    } else {
      showMessage(
        "Le partage n'est pas pris en charge par votre navigateur. Vous pouvez télécharger le mème et le partager manuellement.",
        "warning",
      )
    }
  }

  /**
   * Affiche un onglet spécifique (éditeur ou galerie)
   */
  function showTab(tabName) {
    if (tabName === "editor") {
      elements.editorTab.classList.add("tab-active")
      elements.galleryTab.classList.remove("tab-active")
      elements.editorContent.classList.remove("hidden")
      elements.galleryContent.classList.add("hidden")

      // Ajouter une animation
      elements.editorContent.classList.add("fade-in")
      setTimeout(() => elements.editorContent.classList.remove("fade-in"), 500)
    } else if (tabName === "gallery") {
      elements.galleryTab.classList.add("tab-active")
      elements.editorTab.classList.remove("tab-active")
      elements.galleryContent.classList.remove("hidden")
      elements.editorContent.classList.add("hidden")

      // Ajouter une animation
      elements.galleryContent.classList.add("fade-in")
      setTimeout(() => elements.galleryContent.classList.remove("fade-in"), 500)

      // Recharger les mèmes à chaque fois qu'on affiche la galerie
      loadSavedMemes()
    }
  }

  /**
   * Active les boutons d'action
   */
  function enableButtons() {
    elements.downloadBtn.disabled = false
    elements.shareBtn.disabled = false
    elements.saveBtn.disabled = false
  }

  /**
   * Désactive les boutons d'action
   */
  function disableButtons() {
    elements.downloadBtn.disabled = true
    elements.shareBtn.disabled = true
    elements.saveBtn.disabled = true
  }

  /**
   * Affiche un message d'erreur
   */
  function showError(message) {
    showNotification(message, "error")
  }

  /**
   * Affiche un message de succès
   */
  function showMessage(message, type = "success") {
    showNotification(message, type)
  }

  /**
   * Affiche une notification
   */
  function showNotification(message, type = "info") {
    // Créer un élément de notification
    const notification = document.createElement("div")

    // Définir les classes en fonction du type
    let bgColor, textColor
    switch (type) {
      case "error":
        bgColor = "bg-red-500"
        textColor = "text-white"
        break
      case "success":
        bgColor = "bg-green-500"
        textColor = "text-white"
        break
      case "warning":
        bgColor = "bg-yellow-500"
        textColor = "text-white"
        break
      default:
        bgColor = "bg-blue-500"
        textColor = "text-white"
    }

    notification.className = `fixed top-4 right-4 ${bgColor} ${textColor} px-4 py-2 rounded-md shadow-lg z-50 slide-in`
    notification.textContent = message
    document.body.appendChild(notification)

    // Supprimer la notification après 3 secondes
    setTimeout(() => {
      notification.classList.add("fade-out")
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification)
        }
      }, 300)
    }, 3000)
  }
}


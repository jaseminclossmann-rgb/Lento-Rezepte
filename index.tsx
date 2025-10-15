import { GoogleGenAI, Type } from "@google/genai";

// --- TYPE DECLARATIONS FOR LIBRARIES ---
declare const html2canvas: any;
declare const jspdf: { jsPDF: any };

// --- DOM ELEMENT REFERENCES ---
// Page containers
const pageInput = document.getElementById('page-input') as HTMLDivElement;
const pageLoading = document.getElementById('page-loading') as HTMLDivElement;
const pageOutput = document.getElementById('page-output') as HTMLDivElement;

// Recipe Form
const recipeForm = document.getElementById('recipe-form') as HTMLFormElement;
const generateButton = document.getElementById('generate-button') as HTMLButtonElement;
const buttonText = generateButton.querySelector('.button-text') as HTMLSpanElement;
const buttonSpinner = generateButton.querySelector('.spinner') as HTMLDivElement;
const recipeOutput = document.getElementById('recipe-output') as HTMLDivElement;
const customCategoryContainer = document.getElementById('custom-category-container') as HTMLDivElement;
const categoryRadios = document.querySelectorAll<HTMLInputElement>('input[name="category"]');

// Meal Planner Elements
const mealPlanForm = document.getElementById('meal-plan-form') as HTMLFormElement;
const generatePlanButton = document.getElementById('generate-plan-button') as HTMLButtonElement;
const planButtonText = generatePlanButton.querySelector('.button-text') as HTMLSpanElement;
const planButtonSpinner = generatePlanButton.querySelector('.spinner') as HTMLDivElement;
const mealPlanOutput = document.getElementById('meal-plan-output') as HTMLDivElement;

// Favorites Elements
const favoritesOutput = document.getElementById('favorites-output') as HTMLDivElement;

// Tab Elements
const tabRecipe = document.getElementById('tab-recipe') as HTMLButtonElement;
const tabPlanner = document.getElementById('tab-planner') as HTMLButtonElement;
const tabFavorites = document.getElementById('tab-favorites') as HTMLButtonElement;
const panelRecipe = document.getElementById('panel-recipe') as HTMLDivElement;
const panelPlanner = document.getElementById('panel-planner') as HTMLDivElement;
const panelFavorites = document.getElementById('panel-favorites') as HTMLDivElement;
const showFavoritesButton = document.getElementById('show-favorites-button') as HTMLButtonElement;


// Loading Page Elements
const progressBarInner = document.querySelector('.progress-bar-inner') as HTMLDivElement;
const funFactText = document.getElementById('fun-fact-text') as HTMLParagraphElement;


// --- INITIALIZE GEMINI API ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- STATE MANAGEMENT ---
let currentRecipeData: any = null;
let currentMealPlanData: any = null;
let currentCookingStep = 0;
let funFactInterval: number | null = null;
let favoriteRecipes: any[] = [];

// --- FUN FACTS ---
const funFacts = [
    "Avocados sind Beeren, aber Erdbeeren nicht.",
    "Brokkoli enthält mehr Vitamin C als eine Orange.",
    "Mandeln gehören zur Familie der Pfirsiche.",
    "Der Apfel, den du isst, könnte über 100 Jahre alt sein (dank spezieller Lagerung).",
    "Honig wird niemals schlecht.",
    "Karotten waren ursprünglich lila.",
    "Gurken bestehen zu 96% aus Wasser.",
    "Cashewkerne wachsen an der Außenseite einer Frucht.",
    "Ketchup wurde im 19. Jahrhundert als Medizin verkauft."
];


// --- RECIPE SCHEMA FOR JSON OUTPUT ---
const recipeSchema = {
  type: Type.OBJECT,
  properties: {
    recipeName: { type: Type.STRING, description: "Der Titel des Rezepts." },
    ingredients: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Zutatenliste mit exakten Mengenangaben für die angegebene Personenzahl."
    },
    instructions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Schritt-für-Schritt-Zubereitungsanleitung."
    },
    shoppingList: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Eine separate Einkaufsliste für alle benötigten Zutaten."
    },
    nutrition: {
      type: Type.OBJECT,
      properties: {
        calories: { type: Type.STRING, description: "Kalorien pro Portion." },
        protein: { type: Type.STRING, description: "Eiweiß in Gramm pro Portion." },
        carbs: { type: Type.STRING, description: "Kohlenhydrate in Gramm pro Portion." },
        fat: { type: Type.STRING, description: "Fett in Gramm pro Portion." }
      },
      required: ["calories", "protein", "carbs", "fat"],
      description: "Nährwertangaben pro Portion."
    },
    tips: {
      type: Type.STRING,
      description: "Optionale Tipps für gesunde Varianten oder Alternativen."
    }
  },
  required: ["recipeName", "ingredients", "instructions", "shoppingList", "nutrition"]
};

const mealPlanSchema = {
    type: Type.OBJECT,
    properties: {
        planTitle: { type: Type.STRING, description: "Ein passender Titel für den Wochenplan, z.B. 'Proteinreiche Woche'."},
        dailyPlans: {
            type: Type.ARRAY,
            description: "Eine Liste von Tagesplänen, für jeden angeforderten Tag.",
            items: {
                type: Type.OBJECT,
                properties: {
                    day: { type: Type.STRING, description: "Der Tag, z.B. 'Tag 1'."},
                    meals: {
                        type: Type.ARRAY,
                        description: "Die Gerichte für diesen Tag.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                mealType: { type: Type.STRING, description: "Art der Mahlzeit, z.B. 'Mittagessen'."},
                                recipeName: { type: Type.STRING, description: "Name des Gerichts."},
                                ingredients: { type: Type.ARRAY, items: { type: Type.STRING }},
                                instructions: { type: Type.ARRAY, items: { type: Type.STRING }}
                            },
                             required: ["mealType", "recipeName", "ingredients", "instructions"]
                        }
                    }
                },
                required: ["day", "meals"]
            }
        }
    },
    required: ["planTitle", "dailyPlans"]
};

/**
 * Shows the specified page and hides the others.
 * @param {'input' | 'loading' | 'output'} pageName The page to show.
 */
const showPage = (pageName: 'input' | 'loading' | 'output') => {
    pageInput.classList.add('hidden');
    pageLoading.classList.add('hidden');
    pageOutput.classList.add('hidden');

    if (pageName === 'input') {
        pageInput.classList.remove('hidden');
    } else if (pageName === 'loading') {
        pageLoading.classList.remove('hidden');
    } else {
        pageOutput.classList.remove('hidden');
    }
    window.scrollTo(0, 0);
};

/**
 * Resets the application to its initial state.
 */
const resetApp = () => {
    recipeForm.reset();
    mealPlanForm.reset();
    recipeOutput.innerHTML = `<p class="placeholder">Dein persönliches Rezept erscheint hier...</p>`;
    mealPlanOutput.innerHTML = `<p class="placeholder">Dein persönlicher Wochenplan erscheint hier...</p>`;
    customCategoryContainer.classList.add('hidden');
    showPage('input');
};

/**
 * Starts the loading animation and fun facts display.
 */
const startLoadingAnimation = () => {
    showPage('loading');
    
    // Animate progress bar
    progressBarInner.style.width = '0%';
    setTimeout(() => { progressBarInner.style.width = '30%'; }, 100);
    setTimeout(() => { progressBarInner.style.width = '65%'; }, 1500);
    setTimeout(() => { progressBarInner.style.width = '90%'; }, 4000);

    // Cycle through fun facts
    let funFactIndex = 0;
    funFactText.textContent = funFacts[funFactIndex];
    if (funFactInterval) clearInterval(funFactInterval);
    funFactInterval = window.setInterval(() => {
        funFactIndex = (funFactIndex + 1) % funFacts.length;
        // FIX: The left-hand side of an assignment expression may not be an optional property access.
        // Added a check for parentElement before assigning to its style.
        const parent = funFactText.parentElement;
        if (parent) {
            parent.style.animation = 'none';
            void parent.offsetWidth; // Trigger reflow
            parent.style.animation = 'fadeIn 0.8s forwards';
        }
        funFactText.textContent = funFacts[funFactIndex];
    }, 4000);
};

/**
 * Stops the loading animation.
 */
const stopLoadingAnimation = () => {
    progressBarInner.style.width = '100%';
    if (funFactInterval) clearInterval(funFactInterval);
};

/**
 * Handles the form submission to generate a single recipe.
 * @param {Event} e - The form submission event.
 */
const handleFormSubmit = async (e: Event) => {
    e.preventDefault();
    setLoadingState(true, 'recipe');
    startLoadingAnimation();

    try {
        const formData = new FormData(recipeForm);
        const prompt = buildPromptFromFormData(formData);
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: "Du bist eine Rezept-KI, die nur gesunde, ausgewogene und leicht nachkochbare Gerichte auf Deutsch vorschlägt. Gib deine Antwort ausschließlich im JSON-Format zurück, das dem bereitgestellten Schema entspricht.",
                responseMimeType: "application/json",
                responseSchema: recipeSchema,
            },
        });

        stopLoadingAnimation();
        currentRecipeData = JSON.parse(response.text);
        handleTabClick({ currentTarget: tabRecipe } as unknown as Event);
        renderRecipe(currentRecipeData);
        showPage('output');

    } catch (error) {
        console.error("Error generating recipe:", error);
        resetApp();
        alert("Entschuldigung, es ist ein Fehler aufgetreten. Bitte versuche es später erneut.");
    } finally {
        setLoadingState(false, 'recipe');
    }
};

/**
 * Handles form submission for the meal planner.
 * @param {Event} e The form submission event.
 */
const handleMealPlanSubmit = async (e: Event) => {
    e.preventDefault();
    setLoadingState(true, 'plan');
    startLoadingAnimation();

    try {
        const planFormData = new FormData(mealPlanForm);
        const recipeFormData = new FormData(recipeForm);
        const prompt = buildMealPlanPrompt(planFormData, recipeFormData);

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: "Du bist ein Ernährungsberater und KI-Koch, der gesunde, abwechslungsreiche und leicht nachkochbare Wochenpläne auf Deutsch erstellt. Gib deine Antwort ausschließlich im JSON-Format zurück, das dem bereitgestellten Schema entspricht.",
                responseMimeType: "application/json",
                responseSchema: mealPlanSchema,
            },
        });

        stopLoadingAnimation();
        currentMealPlanData = JSON.parse(response.text);
        handleTabClick({ currentTarget: tabPlanner } as unknown as Event);
        renderMealPlan(currentMealPlanData);
        showPage('output');

    } catch (error) {
        console.error("Error generating meal plan:", error);
        resetApp();
        alert("Entschuldigung, es ist ein Fehler aufgetreten. Bitte versuche es später erneut.");
    } finally {
        setLoadingState(false, 'plan');
    }
};


/**
 * Constructs the user prompt for a single recipe based on form data.
 * @param {FormData} formData - The data from the recipe form.
 * @returns {string} The constructed prompt for the AI.
 */
const buildPromptFromFormData = (formData: FormData): string => {
    let category = formData.get('category') as string;
    if (category === 'custom') {
        const customCategory = formData.get('custom-category') as string;
        category = customCategory.trim() !== '' ? customCategory : 'ein beliebiges Gericht';
    }
    
    const dietaryGoals = formData.getAll('dietary-goal').join(', ') || 'keine speziellen';
    const ingredients = formData.get('ingredients') as string || 'bitte vorschlagen';
    const servings = formData.get('servings') as string;
    const prepTime = formData.get('prep-time') as string;
    const difficulty = formData.get('difficulty') as string;

    return `
Erstelle ein Rezept mit den folgenden Kriterien:
- Kategorie: ${category}
- Ernährungsziele: ${dietaryGoals}
- Vorhandene Zutaten: ${ingredients}
- Anzahl Personen: ${servings}
- Maximale Zubereitungszeit: ${prepTime} Minuten
- Schwierigkeitsgrad: ${difficulty}

Stelle sicher, dass alle Mengenangaben in der Zutatenliste und der Einkaufsliste genau auf ${servings} Person(en) abgestimmt sind.
`;
};

/**
 * Constructs the user prompt for a meal plan.
 * @param {FormData} planFormData Data from the meal plan form.
 * @param {FormData} recipeFormData Data from the general recipe form for preferences.
 * @returns {string} The constructed prompt for the AI.
 */
const buildMealPlanPrompt = (planFormData: FormData, recipeFormData: FormData): string => {
    const days = planFormData.get('plan-days') as string;
    const servings = planFormData.get('plan-servings') as string;
    const meals = Array.from(planFormData.getAll('meals')).join(', ');

    let category = recipeFormData.get('category') as string;
     if (category === 'custom') {
        const customCategory = recipeFormData.get('custom-category') as string;
        category = customCategory.trim() !== '' ? customCategory : 'ein beliebiges Gericht';
    }
    const dietaryGoals = Array.from(recipeFormData.getAll('dietary-goal')).join(', ') || 'keine speziellen';

    return `
Erstelle einen abwechslungsreichen und gesunden Essensplan mit den folgenden Kriterien:
- Dauer des Plans: ${days} Tage
- Anzahl Personen: ${servings}
- Benötigte Mahlzeiten pro Tag: ${meals}
- Allgemeiner Ernährungsstil: ${category}
- Spezifische Ernährungsziele: ${dietaryGoals}

Stelle sicher, dass alle Mengenangaben in den Zutatenlisten genau auf ${servings} Person(en) abgestimmt sind.
Der Plan sollte vielfältig sein und möglichst keine Gerichte wiederholen.
`;
};

/**
 * Renders the generated recipe JSON into the output container.
 * @param {any} recipe - The recipe object parsed from the AI's JSON response.
 */
const renderRecipe = (recipe: any) => {
    const createList = (items: string[]) => items.map(item => `<li>${item}</li>`).join('');
    const isAlreadyFavorite = isFavorite(recipe.recipeName);

    const recipeHtml = `
        <div class="recipe-content">
            <div id="image-generation-container">
                 <button id="generate-image-button">
                    <span class="button-text">Bild zum Rezept erstellen</span>
                    <div class="spinner" style="display: none;"></div>
                </button>
            </div>
            <h3>${recipe.recipeName}</h3>

            <h4>Zutaten</h4>
            <ul>${createList(recipe.ingredients)}</ul>

            <h4>Zubereitung</h4>
            <ol>${createList(recipe.instructions)}</ol>

            <h4>Einkaufsliste</h4>
            <ul>${createList(recipe.shoppingList)}</ul>
            
            <h4>Nährwertangaben (pro Portion)</h4>
            <div class="nutrition-grid">
                <div>Kalorien: <span>${recipe.nutrition.calories}</span></div>
                <div>Eiweiß: <span>${recipe.nutrition.protein}</span></div>
                <div>Kohlenhydrate: <span>${recipe.nutrition.carbs}</span></div>
                <div>Fett: <span>${recipe.nutrition.fat}</span></div>
            </div>

            ${recipe.tips ? `<h4>Tipps & Varianten</h4><p>${recipe.tips}</p>` : ''}
        </div>
        <div class="button-group">
            <button class="secondary-button save-button ${isAlreadyFavorite ? 'saved' : ''}" id="save-favorite-button" ${isAlreadyFavorite ? 'disabled' : ''}>
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                 <span>${isAlreadyFavorite ? 'Gespeichert' : 'Als Favorit speichern'}</span>
            </button>
            <button class="secondary-button" id="new-recipe-button">Neues Rezept erstellen</button>
            <button class="secondary-button" id="start-cooking-mode">Koch-Modus starten</button>
            <button class="print-button" id="print-button">Als PDF speichern</button>
        </div>
    `;
    recipeOutput.innerHTML = recipeHtml;

    document.getElementById('generate-image-button')?.addEventListener('click', () => handleGenerateImageClick(recipe.recipeName));
    document.getElementById('new-recipe-button')?.addEventListener('click', resetApp);
    document.getElementById('start-cooking-mode')?.addEventListener('click', startCookingMode);
    document.getElementById('print-button')?.addEventListener('click', () => handleSaveAsPdf(recipe.recipeName));
    document.getElementById('save-favorite-button')?.addEventListener('click', () => handleSaveFavorite(recipe));
};

/**
 * Renders the generated meal plan.
 * @param {any} plan The meal plan object.
 */
const renderMealPlan = (plan: any) => {
    let planHtml = `<h2>${plan.planTitle}</h2>`;
    
    plan.dailyPlans.forEach((dailyPlan: any) => {
        planHtml += `<div class="day-plan">`;
        planHtml += `<h3>${dailyPlan.day}</h3>`;
        dailyPlan.meals.forEach((meal: any) => {
            planHtml += `
                <details class="meal-details">
                    <summary>
                        <strong>${meal.mealType}:</strong> ${meal.recipeName}
                    </summary>
                    <div class="meal-content">
                        <h4>Zutaten</h4>
                        <ul>${meal.ingredients.map((i: string) => `<li>${i}</li>`).join('')}</ul>
                        <h4>Zubereitung</h4>
                        <ol>${meal.instructions.map((i: string) => `<li>${i}</li>`).join('')}</ol>
                    </div>
                </details>
            `;
        });
        planHtml += `</div>`;
    });
    
    planHtml += `
        <div class="button-group">
            <button class="secondary-button" id="new-plan-button">Neuen Plan erstellen</button>
            <button class="print-button" id="generate-shopping-list">Einkaufsliste erstellen</button>
        </div>
    `;

    mealPlanOutput.innerHTML = planHtml;
    document.getElementById('new-plan-button')?.addEventListener('click', resetApp);
    document.getElementById('generate-shopping-list')?.addEventListener('click', handleGenerateShoppingList);
};

/**
 * Handles the generation of the consolidated shopping list.
 */
const handleGenerateShoppingList = async () => {
    const button = document.getElementById('generate-shopping-list') as HTMLButtonElement;
    if (!button || !currentMealPlanData) return;

    button.disabled = true;
    button.innerText = 'Liste wird erstellt...';

    // Create a simple text representation of all ingredients
    let allIngredientsText = '';
    currentMealPlanData.dailyPlans.forEach((day: any) => {
        day.meals.forEach((meal: any) => {
            allIngredientsText += meal.ingredients.join('\n') + '\n';
        });
    });

    try {
        const prompt = `
Hier ist eine unsortierte Liste von Zutaten für einen ganzen Wochenplan.
Bitte fasse alle doppelten Einträge zusammen (z.B. "1 Zwiebel" und "2 Zwiebeln" wird zu "3 Zwiebeln") und sortiere die finale Liste nach sinnvollen Supermarkt-Kategorien (z.B. Obst & Gemüse, Milchprodukte, Fleisch & Fisch, Trockenwaren, Gewürze).
Gib nur die finale, zusammengefasste und sortierte Liste zurück.

Zutaten:
${allIngredientsText}
`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        renderShoppingList(response.text);

    } catch (error) {
        console.error("Error generating shopping list:", error);
        alert("Die Einkaufsliste konnte nicht erstellt werden.");
    } finally {
        button.disabled = false;
        button.innerText = 'Einkaufsliste erstellen';
    }
};

/**
 * Renders the shopping list and the pantry check UI.
 * @param {string} shoppingListText The generated shopping list text.
 */
const renderShoppingList = (shoppingListText: string) => {
    const listHtml = `
        <div class="shopping-list-container">
            <h3>Konsolidierte Einkaufsliste</h3>
            <div id="shopping-list-content">${shoppingListText.replace(/\n/g, '<br>')}</div>
            <hr>
            <h4>Vorrats-Check</h4>
            <p>Was hast du schon zu Hause? Trage es hier ein, um die Liste anzupassen.</p>
            <textarea id="pantry-items" rows="4" placeholder="z.B. Olivenöl, 2 Eier, Reis, Salz..."></textarea>
            <div class="button-group">
                <button class="secondary-button" id="adjust-shopping-list">Liste anpassen</button>
            </div>
        </div>
    `;
    // Prepend the list to the meal plan output
    mealPlanOutput.insertAdjacentHTML('beforeend', listHtml);
    document.getElementById('generate-shopping-list')?.remove();
    document.getElementById('adjust-shopping-list')?.addEventListener('click', handleAdjustShoppingList);
};

/**
 * Adjusts the shopping list based on pantry items.
 */
const handleAdjustShoppingList = async () => {
    const button = document.getElementById('adjust-shopping-list') as HTMLButtonElement;
    const pantryItems = (document.getElementById('pantry-items') as HTMLTextAreaElement)?.value;
    const shoppingListContent = document.getElementById('shopping-list-content');
    if (!button || !pantryItems || !shoppingListContent) return;
    
    button.disabled = true;
    button.innerText = 'Wird angepasst...';
    const originalList = shoppingListContent.innerText;

    try {
        const prompt = `
Hier ist eine Einkaufsliste und eine Liste von Dingen, die ich bereits zu Hause habe.
Bitte vergleiche beides. Erstelle eine finale Einkaufsliste, in der du alle Artikel, die ich schon habe, entweder entfernst oder deutlich als "vorhanden" markierst (z.B. durchstreichen mit ~~).

Einkaufsliste:
${originalList}

Bereits vorhanden:
${pantryItems}
`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        
        let adjustedHtml = response.text
            .replace(/~~(.*?)~~/g, '<del>$1</del>') // Convert markdown strikethrough
            .replace(/\n/g, '<br>');

        shoppingListContent.innerHTML = `<strong>Angepasste Liste:</strong><br>${adjustedHtml}`;
        button.closest('.shopping-list-container')?.querySelector('h4')?.remove();
        button.closest('.shopping-list-container')?.querySelector('p')?.remove();
        button.closest('.shopping-list-container')?.querySelector('textarea')?.remove();
        button.remove();

    } catch (error) {
         console.error("Error adjusting shopping list:", error);
         alert("Die Liste konnte nicht angepasst werden.");
    }
};

/**
 * Shows a confirmation modal before generating an image for a recipe.
 * @param {string} recipeName - The name of the recipe to generate an image for.
 */
const handleGenerateImageClick = (recipeName: string) => {
    if (document.querySelector('.confirmation-modal')) return;

    const modal = document.createElement('div');
    modal.className = 'confirmation-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3 class="modal-title">Hinweis zur Ressourcennutzung</h3>
            <p>Jede Bildgenerierung verbraucht Rechenleistung und verursacht Kosten für Lento.</p>
            <p>Bitte nutze diese Funktion bedacht. Möchtest du trotzdem ein Bild erstellen?</p>
            <div class="modal-buttons">
                <button class="modal-button cancel">Abbrechen</button>
                <button class="modal-button confirm">Ja, erstellen</button>
            </div>
        </div>
    `;

    const closeModal = () => {
        modal.remove();
    };

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    modal.querySelector('.cancel')?.addEventListener('click', closeModal);
    
    modal.querySelector('.confirm')?.addEventListener('click', () => {
        closeModal();
        generateRecipeImage(recipeName);
    });

    document.body.appendChild(modal);
};


/**
 * Generates and renders an image for the recipe.
 * @param {string} recipeName - The name of the recipe to generate an image for.
 */
const generateRecipeImage = async (recipeName: string) => {
    const imageContainer = document.getElementById('image-generation-container');
    const genButton = document.getElementById('generate-image-button') as HTMLButtonElement;
    if (!imageContainer || !genButton) return;

    const btnText = genButton.querySelector('.button-text') as HTMLSpanElement;
    const btnSpinner = genButton.querySelector('.spinner') as HTMLDivElement;

    genButton.disabled = true;
    btnText.textContent = 'Bild wird generiert...';
    btnSpinner.style.display = 'block';

    try {
        const imagePrompt = `Professionelles Food-Foto, hell und appetitlich, von "${recipeName}", auf einem rustikalen Holztisch angerichtet, im Stil einer hochwertigen Kochzeitschrift.`;
        
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: imagePrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '16:9',
            },
        });
        
        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;

        const image = new Image();
        image.onload = () => {
            imageContainer.innerHTML = ''; // Clear button
            imageContainer.style.border = 'none';
            imageContainer.appendChild(image);
        };
        image.src = imageUrl;
        image.alt = `Generiertes Bild für ${recipeName}`;

    } catch (error) {
        console.error('Error generating image:', error);
        alert("Das Bild konnte leider nicht erstellt werden. Bitte versuchen Sie es erneut.");
        genButton.disabled = false;
        btnText.textContent = 'Bild zum Rezept erstellen';
        btnSpinner.style.display = 'none';
    }
};


/**
 * Handles generating and downloading a PDF of the recipe.
 * @param {string} recipeName - The name of the recipe for the filename.
 */
const handleSaveAsPdf = async (recipeName: string) => {
    const printButton = document.getElementById('print-button') as HTMLButtonElement;
    if (!printButton) return;

    const originalButtonText = printButton.innerText;
    printButton.disabled = true;
    printButton.innerText = 'PDF wird erstellt...';

    try {
        const recipeContent = document.querySelector('.recipe-content') as HTMLElement;
        if (!recipeContent) {
            throw new Error("Recipe content element not found for PDF generation.");
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));

        const canvas = await html2canvas(recipeContent, { 
            scale: 2,
            useCORS: true,
            allowTaint: true
        });
        const imgData = canvas.toDataURL('image/png');
        
        const { jsPDF } = jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const canvasRatio = canvasHeight / canvasWidth;
        
        const margin = 15;
        const contentWidth = pdfWidth - (margin * 2);
        const contentHeight = contentWidth * canvasRatio;

        let heightLeft = contentHeight;
        let position = 0;
        
        pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position = heightLeft - contentHeight + margin;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
            heightLeft -= (pdfHeight - margin*2);
        }

        const safeFilename = recipeName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        pdf.save(`Rezept_${safeFilename}.pdf`);

    } catch (error) {
        console.error("Failed to generate PDF:", error);
        alert("Entschuldigung, das PDF konnte nicht erstellt werden.");
    } finally {
        printButton.disabled = false;
        printButton.innerText = originalButtonText;
    }
};

/**
 * Toggles the loading state of the generate buttons.
 * @param {boolean} isLoading - Whether to show the loading state.
 * @param {'recipe' | 'plan'} type - Which button to update.
 */
const setLoadingState = (isLoading: boolean, type: 'recipe' | 'plan') => {
    if (type === 'recipe') {
        generateButton.disabled = isLoading;
        buttonText.style.display = isLoading ? 'none' : 'block';
        buttonSpinner.style.display = isLoading ? 'block' : 'none';
    } else {
        generatePlanButton.disabled = isLoading;
        planButtonText.style.display = isLoading ? 'none' : 'block';
        planButtonSpinner.style.display = isLoading ? 'block' : 'none';
    }
};

// --- TAB SWITCHING LOGIC ---
const handleTabClick = (e: Event) => {
    const target = e.currentTarget as HTMLButtonElement;
    
    // Deactivate all tabs and panels
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });
     document.querySelectorAll('.tab-panel').forEach(panel => {
        (panel as HTMLElement).classList.remove('active');
    });
    
    // Hide all output containers
    recipeOutput.style.display = 'none';
    mealPlanOutput.style.display = 'none';
    favoritesOutput.style.display = 'none';


    target.classList.add('active');
    target.setAttribute('aria-selected', 'true');

    if (target.id === 'tab-recipe') {
        panelRecipe.classList.add('active');
        recipeOutput.style.display = 'block';
    } else if (target.id === 'tab-planner') {
        panelPlanner.classList.add('active');
        mealPlanOutput.style.display = 'block';
    } else if (target.id === 'tab-favorites') {
        panelFavorites.classList.add('active');
        favoritesOutput.style.display = 'block';
        renderFavoritesList();
    }
};


// --- FAVORITES FUNCTIONS ---

const loadFavoritesFromStorage = () => {
    const favoritesJson = localStorage.getItem('favoriteRecipes');
    if (favoritesJson) {
        favoriteRecipes = JSON.parse(favoritesJson);
    }
};

const saveFavoritesToStorage = () => {
    localStorage.setItem('favoriteRecipes', JSON.stringify(favoriteRecipes));
};

const isFavorite = (recipeName: string): boolean => {
    return favoriteRecipes.some(recipe => recipe.recipeName === recipeName);
};

const handleSaveFavorite = (recipe: any) => {
    if (!isFavorite(recipe.recipeName)) {
        favoriteRecipes.push(recipe);
        saveFavoritesToStorage();
        
        // Update button state
        const saveButton = document.getElementById('save-favorite-button') as HTMLButtonElement;
        if (saveButton) {
            saveButton.classList.add('saved');
            saveButton.disabled = true;
            saveButton.querySelector('span')!.textContent = 'Gespeichert';
        }
    }
};

const handleRemoveFavorite = (recipeName: string) => {
    favoriteRecipes = favoriteRecipes.filter(recipe => recipe.recipeName !== recipeName);
    saveFavoritesToStorage();
    renderFavoritesList();
};

const renderFavoritesList = () => {
    if (favoriteRecipes.length === 0) {
        favoritesOutput.innerHTML = `<p class="placeholder">Du hast noch keine Favoriten gespeichert.</p>`;
        return;
    }

    const listHtml = favoriteRecipes.map((recipe, index) => `
        <li class="favorite-item">
            <span class="favorite-item-name">${recipe.recipeName}</span>
            <div class="favorite-item-buttons">
                <button class="secondary-button" data-index="${index}" id="view-favorite-${index}">Anzeigen</button>
                <button class="secondary-button remove-favorite-button" data-recipe-name="${recipe.recipeName}" id="remove-favorite-${index}">Entfernen</button>
            </div>
        </li>
    `).join('');

    favoritesOutput.innerHTML = `
        <h3>Deine Favoriten</h3>
        <ul class="favorites-list">${listHtml}</ul>
         <div class="button-group">
            <button class="secondary-button" id="back-to-generator-button">Zurück zum Generator</button>
        </div>
    `;

    favoriteRecipes.forEach((_, index) => {
        document.getElementById(`view-favorite-${index}`)?.addEventListener('click', () => {
            handleTabClick({ currentTarget: tabRecipe } as unknown as Event);
            renderRecipe(favoriteRecipes[index]);
            showPage('output');
        });
        document.getElementById(`remove-favorite-${index}`)?.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            handleRemoveFavorite(target.dataset.recipeName || '');
        });
    });

    document.getElementById('back-to-generator-button')?.addEventListener('click', () => {
         handleTabClick({ currentTarget: tabRecipe } as unknown as Event);
         showPage('input');
    });
};


// --- COOKING MODE FUNCTIONS ---

const handleCookingModalClick = (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.closest('.close-cooking-mode')) {
        closeCookingMode();
        return;
    }
    const prevButton = target.closest('.prev-step') as HTMLButtonElement;
    if (prevButton && !prevButton.disabled) {
        if (currentCookingStep > 0) {
            currentCookingStep--;
            renderCookingStep();
        }
        return;
    }
    const nextButton = target.closest('.next-step') as HTMLButtonElement;
    if (nextButton && !nextButton.disabled) {
        const totalSteps = currentRecipeData.instructions.length;
        if (currentCookingStep < totalSteps - 1) {
            currentCookingStep++;
            renderCookingStep();
        }
        return;
    }
    const timerButton = target.closest('.timer-button') as HTMLButtonElement;
    if (timerButton && !timerButton.disabled) {
        const minutes = parseInt(timerButton.dataset.minutes || '0', 10);
        if (minutes > 0) startTimer(minutes, timerButton);
        return;
    }
};

const startCookingMode = () => {
    if (!currentRecipeData) return;
    currentCookingStep = 0;
    
    const modal = document.createElement('div');
    modal.className = 'cooking-modal';
    modal.innerHTML = `<div class="cooking-modal-content"></div>`;
    
    modal.addEventListener('click', handleCookingModalClick);

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    renderCookingStep();
};

const renderCookingStep = () => {
    const modalContent = document.querySelector('.cooking-modal-content');
    if (!modalContent) return;

    const instruction = currentRecipeData.instructions[currentCookingStep];
    const totalSteps = currentRecipeData.instructions.length;

    const stepIngredients = currentRecipeData.ingredients.filter((ing: string) => {
        const mainWord = ing.split(' ')[1]?.replace(/,/g, '') || ing.split(' ')[0];
        return new RegExp(`\\b${mainWord}\\b`, 'i').test(instruction);
    }).map((ing: string) => `<li>${ing}</li>`).join('');

    const timerRegex = /(\d+)\s*(minuten|minute|min)/i;
    const timerMatch = instruction.match(timerRegex);
    let timerHtml = '';
    if (timerMatch) {
        const minutes = parseInt(timerMatch[1], 10);
        timerHtml = `<button class="timer-button" data-minutes="${minutes}">Start ${minutes} Min. Timer</button><div class="timer-display"></div>`;
    }

    modalContent.innerHTML = `
        <button class="close-cooking-mode">&times;</button>
        <div class="step-header">
            <h3>Schritt ${currentCookingStep + 1} / ${totalSteps}</h3>
        </div>
        <p class="current-instruction">${instruction}</p>
        ${stepIngredients ? `<h4>Zutaten für diesen Schritt:</h4><ul>${stepIngredients}</ul>` : ''}
        ${timerHtml}
        <div class="cooking-nav">
            <button class="nav-button prev-step" ${currentCookingStep === 0 ? 'disabled' : ''}>&larr; Zurück</button>
            <button class="nav-button next-step" ${currentCookingStep === totalSteps - 1 ? 'disabled' : ''}>Weiter &rarr;</button>
        </div>
    `;
};

const closeCookingMode = () => {
    const modal = document.querySelector('.cooking-modal');
    if (modal) {
        modal.removeEventListener('click', handleCookingModalClick);
        modal.remove();
    }
    document.body.style.overflow = 'auto';
};

const startTimer = (minutes: number, button: HTMLButtonElement) => {
    const display = document.querySelector('.timer-display') as HTMLElement;
    if (!display) return;
    
    let duration = minutes * 60;
    button.disabled = true;

    const timerInterval = setInterval(() => {
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        display.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        
        if (--duration < 0) {
            clearInterval(timerInterval);
            display.textContent = "Zeit ist um!";
            button.disabled = false;
        }
    }, 1000);
};

// --- EVENT LISTENERS ---
recipeForm.addEventListener('submit', handleFormSubmit);
mealPlanForm.addEventListener('submit', handleMealPlanSubmit);
tabRecipe.addEventListener('click', handleTabClick);
tabPlanner.addEventListener('click', handleTabClick);
tabFavorites.addEventListener('click', handleTabClick);
showFavoritesButton.addEventListener('click', () => {
    handleTabClick({ currentTarget: tabFavorites } as unknown as Event);
    showPage('output');
});


// --- INITIALIZE APP ---
const initializeApp = () => {
    loadFavoritesFromStorage();
    showPage('input');
    handleTabClick({ currentTarget: tabRecipe } as unknown as Event); // Set initial tab state
    
    categoryRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const isCustom = document.querySelector<HTMLInputElement>('#category-custom')?.checked;
            if (isCustom) {
                customCategoryContainer.classList.remove('hidden');
            } else {
                customCategoryContainer.classList.add('hidden');
            }
        });
    });
};

initializeApp();
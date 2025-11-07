"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDateTime = exports.formatDate = exports.plural = exports.isLanguageSupported = exports.getAvailableLanguages = exports.getCurrentLanguage = exports.setLanguage = exports.t = void 0;
const translations = {
    en: {
        // Layout and Navigation
        "site.title": "Wikibricks - Your place to meet all your brick needs",
        "site.tagline": "Wikibricks",
        "nav.search": "Search Wikibricks",
        "nav.search.placeholder": "Search Wikibricks",
        "nav.search.button": "Search",
        "nav.login": "Login",
        "nav.logout": "Logout",
        "nav.register": "Create Account",
        "nav.createAccount": "Create Account",
        // Common Actions
        "action.search": "Search",
        "action.previous": "Previous",
        "action.next": "Next",
        "action.seeAll": "See all",
        "action.returnHome": "Return to Home",
        "action.addEntity": "Add Entity",
        // Authentication
        "auth.login": "Login",
        "auth.register": "Create Account",
        "auth.username": "Username",
        "auth.password": "Password",
        "auth.confirmPassword": "Confirm Password",
        "auth.createAccount": "Create Account",
        "auth.loginButton": "Log in",
        "auth.dontHaveAccount": "Don't have an account?",
        "auth.alreadyHaveAccount": "Already have an account?",
        "auth.createOneHere": "Create one here",
        "auth.logInHere": "Log in here",
        "auth.usernameLength": "Username must be between 3-255 characters",
        "auth.passwordLength": "Password must be at least 6 characters",
        // Error Messages
        "error.pageNotFound": "Page Not Found",
        "error.somethingWentWrong": "Something Went Wrong",
        "error.pageNotFoundMessage": "The page you're looking for doesn't exist.",
        "error.unexpectedErrorMessage": "We encountered an unexpected error. Please try again later. An administrator has been notified.",
        "error.allFieldsRequired": "All fields are required",
        "error.usernameLength": "Username must be between 3-255 characters",
        "error.passwordLength": "Password must be at least 6 characters",
        "error.passwordsDoNotMatch": "Passwords do not match",
        "error.usernameExists": "Username already exists",
        "error.accountCreationError": "An error occurred while creating your account. Please try again.",
        "error.invalidCredentials": "Invalid username or password",
        "error.usernamePasswordRequired": "Username and password are required",
        "error.noMessage": "No message",
        // Homepage
        "home.welcome": "Welcome to Wikibricks!",
        "home.description": "Discover a world of creativity and engineering with Brick Wiki, the ultimate resource for toy brick enthusiasts. Whether you're a seasoned builder or a curious newcomer, we've got everything you need to explore the fascinating universe of toy bricks.",
        "home.browseSets": "Browse Sets: ",
        "home.browseSetsBrief": "Explore detailed information on iconic sets from your favorite brands.",
        "home.learnBrands": "Learn About Brands: ",
        "home.learnBrandsBrief": "Dive into the history and legacy of major brands like LEGO, BlueBrixx, and more.",
        "home.exploreBricks": "Explore Bricks: ",
        "home.exploreBricksBrief": "Discover unique brick types, their uses, and how they bring your creations to life.",
        "home.latestSets": "Latest Sets",
        "home.brands": "Brands",
        // Entity Management
        "entities.title": "Entities",
        "entities.type": "Type",
        "entities.name": "Name",
        "entities.date": "Date",
        "entities.searchByName": "Search by name",
        "entities.advancedSearch": "Advanced search",
        "entities.entityType": "Entity Type:",
        "entities.changeRequests": "Change Requests",
        // Entity Types
        "entityType.all": "All",
        "entityType.set": "Set",
        "entityType.brand": "Brand",
        "entityType.wiki": "Wiki",
        // User Profile
        "user.title": "User:",
        "user.recentActivity": "Recent Activity",
        "user.noRecentActivity": "No recent activity",
        "user.entity": "Entity",
        "user.version": "Version",
        "user.userId": "User ID",
        "user.permissionLevel": "Permission Level",
        "user.memberSince": "Member Since",
        "user.imageOf": "Image of",
        // Changes
        "changes.title": "Change Requests",
        "changes.set": "Set",
        "changes.changedBy": "Changed By",
        "changes.message": "Message",
        // Footer
        "footer.content": "Content is available under CC BY-SA unless otherwise noted.",
        "footer.termsPrivacy": "Terms of Use | Privacy Policy",
        // Entity History
        "entity.history.title": "Version History:",
        "entity.history.requestedChanges": "Requested Changes for {name}. Click on a proposed version to view details. Listed in descending order.",
        "entity.history.versionHistory": "Version history for {name}. Click on a version to view details. Listed in descending order.",
        "entity.history.version": "Version",
        "entity.history.created": "Created",
        "entity.history.author": "Author",
        "entity.history.changeMessage": "Change Message",
        // Entity Page
        "entity.pieces": "Pieces",
        "entity.size": "Size",
        "entity.theme": "Theme",
        "entity.issued": "Issued",
        "entity.brand": "Brand",
        "entity.country": "Country",
        "entity.website": "Website",
        "entity.imageOf": "Image of {name}",
        "entity.cancel": "Cancel",
        "entity.editPage": "Edit Page",
        "entity.versionHistory": "Version History",
        "entity.changeMessage": "Change Message",
        "entity.save": "Save",
        "entity.reviewMessage": "Review Message",
        "entity.approve": "Approve",
        "entity.reject": "Reject",
        "entity.approveTooltip": "Approving a change will set the version HEAD to this version and set the version review status to 'approved'",
        "entity.rejectTooltip": "Rejecting a change will discard the request to become the new HEAD version and every possibility to be merged into HEAD.",
        // Demo
        "demo.title": "Translation Demo",
    },
    de: {
        // Layout and Navigation
        "site.title": "Wikibricks - Dein Ort für alle Stein-Bedürfnisse",
        "site.tagline": "Wikibricks",
        "nav.search": "Wikibricks durchsuchen",
        "nav.search.placeholder": "Wikibricks durchsuchen",
        "nav.search.button": "Suchen",
        "nav.login": "Anmelden",
        "nav.logout": "Abmelden",
        "nav.register": "Konto erstellen",
        "nav.createAccount": "Konto erstellen",
        // Common Actions
        "action.search": "Suchen",
        "action.previous": "Zurück",
        "action.next": "Weiter",
        "action.seeAll": "Alle anzeigen",
        "action.returnHome": "Zur Startseite",
        "action.addEntity": "Element hinzufügen",
        // Authentication
        "auth.login": "Anmelden",
        "auth.register": "Konto erstellen",
        "auth.username": "Benutzername",
        "auth.password": "Passwort",
        "auth.confirmPassword": "Passwort bestätigen",
        "auth.createAccount": "Konto erstellen",
        "auth.loginButton": "Anmelden",
        "auth.dontHaveAccount": "Haben Sie noch kein Konto?",
        "auth.alreadyHaveAccount": "Haben Sie bereits ein Konto?",
        "auth.createOneHere": "Hier erstellen",
        "auth.logInHere": "Hier anmelden",
        "auth.usernameLength": "Benutzername muss zwischen 3-255 Zeichen lang sein",
        "auth.passwordLength": "Passwort muss mindestens 6 Zeichen lang sein",
        // Error Messages
        "error.pageNotFound": "Seite nicht gefunden",
        "error.somethingWentWrong": "Etwas ist schief gelaufen",
        "error.pageNotFoundMessage": "Die gesuchte Seite existiert nicht.",
        "error.unexpectedErrorMessage": "Es ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es später erneut. Ein Administrator wurde benachrichtigt.",
        "error.allFieldsRequired": "Alle Felder sind erforderlich",
        "error.usernameLength": "Benutzername muss zwischen 3-255 Zeichen lang sein",
        "error.passwordLength": "Passwort muss mindestens 6 Zeichen lang sein",
        "error.passwordsDoNotMatch": "Passwörter stimmen nicht überein",
        "error.usernameExists": "Benutzername existiert bereits",
        "error.accountCreationError": "Bei der Erstellung Ihres Kontos ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.",
        "error.invalidCredentials": "Ungültiger Benutzername oder Passwort",
        "error.usernamePasswordRequired": "Benutzername und Passwort sind erforderlich",
        "error.noMessage": "Keine Nachricht",
        // Homepage
        "home.welcome": "Willkommen bei Wikibricks!",
        "home.description": "Entdecken Sie eine Welt der Kreativität und des Ingenieurswesens mit Brick Wiki, der ultimativen Ressource für Spielstein-Enthusiasten. Ob Sie ein erfahrener Baumeister oder ein neugieriger Neuling sind, wir haben alles, was Sie brauchen, um das faszinierende Universum der Spielsteine zu erkunden.",
        "home.browseSets": "Sets durchsuchen: ",
        "home.browseSetsBrief": "Erkunden Sie detaillierte Informationen zu ikonischen Sets Ihrer Lieblingsmarken.",
        "home.learnBrands": "Über Marken lernen: ",
        "home.learnBrandsBrief": "Tauchen Sie ein in die Geschichte und das Erbe großer Marken wie LEGO, BlueBrixx und mehr.",
        "home.exploreBricks": "Steine erkunden: ",
        "home.exploreBricksBrief": "Entdecken Sie einzigartige Steintypen, ihre Verwendung und wie sie Ihre Kreationen zum Leben erwecken.",
        "home.latestSets": "Neueste Sets",
        "home.brands": "Marken",
        // Entity Management
        "entities.title": "Elemente",
        "entities.type": "Typ",
        "entities.name": "Name",
        "entities.date": "Datum",
        "entities.searchByName": "Nach Name suchen",
        "entities.advancedSearch": "Erweiterte Suche",
        "entities.entityType": "Elementtyp:",
        "entities.changeRequests": "Änderungsanfragen",
        // Entity Types
        "entityType.all": "Alle",
        "entityType.set": "Set",
        "entityType.brand": "Marke",
        "entityType.wiki": "Wiki",
        // User Profile
        "user.title": "Benutzer:",
        "user.recentActivity": "Letzte Aktivitäten",
        "user.noRecentActivity": "Keine aktuellen Aktivitäten",
        "user.entity": "Element",
        "user.version": "Version",
        "user.userId": "Benutzer-ID",
        "user.permissionLevel": "Berechtigungsstufe",
        "user.memberSince": "Mitglied seit",
        "user.imageOf": "Bild von",
        // Changes
        "changes.title": "Änderungsanfragen",
        "changes.set": "Set",
        "changes.changedBy": "Geändert von",
        "changes.message": "Nachricht",
        // Footer
        "footer.content": "Inhalt ist unter CC BY-SA verfügbar, sofern nicht anders vermerkt.",
        "footer.termsPrivacy": "Nutzungsbedingungen | Datenschutzrichtlinie",
        // Entity History
        "entity.history.title": "Versionshistorie:",
        "entity.history.requestedChanges": "Angeforderte Änderungen für {name}. Klicken Sie auf eine vorgeschlagene Version, um Details zu sehen. In absteigender Reihenfolge aufgelistet.",
        "entity.history.versionHistory": "Versionshistorie für {name}. Klicken Sie auf eine Version, um Details zu sehen. In absteigender Reihenfolge aufgelistet.",
        "entity.history.version": "Version",
        "entity.history.created": "Erstellt",
        "entity.history.author": "Autor",
        "entity.history.changeMessage": "Änderungsnachricht",
        // Entity Page
        "entity.pieces": "Teile",
        "entity.size": "Größe",
        "entity.theme": "Thema",
        "entity.issued": "Ausgegeben",
        "entity.brand": "Marke",
        "entity.country": "Land",
        "entity.website": "Website",
        "entity.imageOf": "Bild von {name}",
        "entity.cancel": "Abbrechen",
        "entity.editPage": "Seite bearbeiten",
        "entity.versionHistory": "Versionshistorie",
        "entity.changeMessage": "Änderungsnachricht",
        "entity.save": "Speichern",
        "entity.reviewMessage": "Überprüfungsnachricht",
        "entity.approve": "Genehmigen",
        "entity.reject": "Ablehnen",
        "entity.approveTooltip": "Die Genehmigung einer Änderung setzt die HEAD-Version auf diese Version und den Überprüfungsstatus auf 'genehmigt'",
        "entity.rejectTooltip": "Die Ablehnung einer Änderung verwirft die Anfrage, die neue HEAD-Version zu werden, und jede Möglichkeit, in HEAD zusammengeführt zu werden.",
        // Demo
        "demo.title": "Übersetzungs-Demo",
    },
};
// Current language state
let currentLanguage = "en";
// Translation API with interpolation support
const t = (key, variables, lang) => {
    var _a;
    const language = lang || currentLanguage;
    const translation = (_a = translations[language]) === null || _a === void 0 ? void 0 : _a[key];
    if (!translation) {
        console.warn(`Translation missing for key: ${key} in language: ${language}`);
        return translations["en"][key] || key;
    }
    // Handle variable interpolation
    if (variables) {
        return Object.entries(variables).reduce((text, [key, value]) => {
            return text.replace(new RegExp(`\\{${key}\\}`, "g"), value);
        }, translation);
    }
    return translation;
};
exports.t = t;
// Set the current language
const setLanguage = (language) => {
    currentLanguage = language;
};
exports.setLanguage = setLanguage;
// Get the current language
const getCurrentLanguage = () => {
    return currentLanguage;
};
exports.getCurrentLanguage = getCurrentLanguage;
// Get available languages
const getAvailableLanguages = () => {
    return Object.keys(translations);
};
exports.getAvailableLanguages = getAvailableLanguages;
// Check if a language is supported
const isLanguageSupported = (language) => {
    return language in translations;
};
exports.isLanguageSupported = isLanguageSupported;
// Pluralization helper for German
const plural = (count, singular, plural) => {
    return count === 1 ? singular : plural;
};
exports.plural = plural;
// Date formatting with locale
const formatDate = (date, lang) => {
    const language = lang || currentLanguage;
    const locale = language === "de" ? "de-DE" : "en-US";
    return date.toLocaleDateString(locale);
};
exports.formatDate = formatDate;
// Date and time formatting with locale
const formatDateTime = (date, lang) => {
    const language = lang || currentLanguage;
    const locale = language === "de" ? "de-DE" : "en-US";
    return date.toLocaleString(locale);
};
exports.formatDateTime = formatDateTime;
// Default export for convenience
exports.default = {
    t: exports.t,
    setLanguage: exports.setLanguage,
    getCurrentLanguage: exports.getCurrentLanguage,
    getAvailableLanguages: exports.getAvailableLanguages,
    isLanguageSupported: exports.isLanguageSupported,
    plural: exports.plural,
    formatDate: exports.formatDate,
    formatDateTime: exports.formatDateTime,
};

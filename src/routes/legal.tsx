import type { Child, PropsWithChildren } from "hono/jsx";
import { LANGUAGE_COOKIE, LANGUAGE_COOKIE_DAYS } from "../language";
import { Layout } from "../layout";
import type { DefaultContext } from "../utils";

const operator = {
  name: "WikiBricks Beispielbetrieb",
  street: "Musterstraße 1",
  city: "12345 Musterstadt",
  country: "Deutschland",
  email: "kontakt@wikibricks.example",
};

const OperatorAddress = () => (
  <address class="not-italic">
    {operator.name}<br />
    {operator.street}<br />
    {operator.city}<br />
    {operator.country}<br />
    <span>E-Mail </span>{operator.email}
  </address>
);

const Section = ({ heading, children }: PropsWithChildren<{ heading: string }>) => (
  <section class="space-y-2">
    <h2 class="text-xl font-semibold">{heading}</h2>
    {children}
  </section>
);

function renderLegalPage(c: DefaultContext, title: string, content: Child) {
  c.header("X-Robots-Tag", "noindex");
  return c.render(
    <Layout context={c} user={c.get("user")} title={`${title} | WikiBricks`}>
      <main lang="de" class="mx-auto w-full max-w-3xl space-y-6">
        <h1 class="border-b pb-2 font-serif text-3xl">{title}</h1>
        <p class="border border-amber-300 bg-amber-50 p-3 text-sm">
          <strong>Beispielentwurf.</strong> Die Betreiberangaben sind fiktiv.
          Vor der Veröffentlichung müssen die Angaben ersetzt und die Texte
          mit dem tatsächlichen Betrieb abgeglichen werden.
        </p>
        {content}
      </main>
    </Layout>,
  );
}

export const handleImprintPage = (c: DefaultContext) =>
  renderLegalPage(c, "Impressum", <>
    <Section heading="Anbieter und Kontakt">
      <OperatorAddress />
    </Section>
    <Section heading="Angaben für die Veröffentlichung">
      <p>
        Hier sind der tatsächliche Name, die ladungsfähige Anschrift und die
        Kontaktdaten des Anbieters einzutragen. Je nach Betreiber können
        weitere Angaben erforderlich sein, etwa Rechtsform, Vertretung,
        Register und Registernummer, Umsatzsteuer-Identifikationsnummer oder
        Aufsichtsbehörde.
      </p>
      <p>
        Für journalistisch-redaktionelle Angebote ist gegebenenfalls die
        verantwortliche Person gesondert anzugeben.
      </p>
      <p>
        Hinweise zum Umgang mit personenbezogenen Daten stehen unter{" "}
        <a href="/datenschutz">Datenschutz</a>.
      </p>
    </Section>
  </>);

export const handlePrivacyPage = (c: DefaultContext) =>
  renderLegalPage(c, "Datenschutz", <>
    <Section heading="Verantwortlicher">
      <OperatorAddress />
    </Section>

    <Section heading="Aufruf der Website, Hosting und Sicherheit">
      <p>
        Die Anwendung wird bei Hetzner gehostet. Cloudflare wird für die
        Bereitstellung und Absicherung der Website eingesetzt. Je nach
        Konfiguration können dabei unter anderem IP-Adresse, Zeitpunkt,
        angefragte URL, HTTP-Status und Browserangaben verarbeitet werden.
        Die Verarbeitung dient der Auslieferung der Website, der Fehlersuche
        und dem Schutz vor Missbrauch.
      </p>
      <p>
        Als Rechtsgrundlage für Bereitstellung und Sicherheit kommt im
        Beispiel Art. 6 Abs. 1 Buchst. f DSGVO in Betracht. Das berechtigte
        Interesse besteht im sicheren und zuverlässigen Betrieb. Je nach
        Cloudflare-Einstellungen können Verarbeitungen außerhalb des EWR
        stattfinden. Der Serverstandort, die eingesetzten Funktionen, die
        konkreten Empfänger und gegebenenfalls die Garantien für
        Drittlandübermittlungen sind vor Veröffentlichung zu ergänzen.
      </p>
      <p>
        <a href="https://www.hetzner.com/legal/privacy-policy/">Datenschutzhinweise von Hetzner</a>
        {" · "}
        <a href="https://www.cloudflare.com/privacypolicy/">Datenschutzhinweise von Cloudflare</a>
      </p>
      <p>
        Nach der aktuellen Betreiberangabe werden Protokolle unbefristet
        gespeichert. Vor Veröffentlichung sind die betroffenen Protokolle,
        ihre konkreten Zwecke und zweckbezogene Löschfristen festzulegen.
        Für personenbezogene Protokolle gilt die Speicherbegrenzung nach
        Art. 5 Abs. 1 Buchst. e DSGVO.
      </p>
    </Section>

    <Section heading="Benutzerkonten und Beiträge">
      <p>
        Für ein Konto speichert WikiBricks den Benutzernamen, einen
        Passwort-Hash und das Datum der Registrierung. Bei Bearbeitungen und
        Bild-Uploads kommen die eingereichten Inhalte und ihre Zuordnung zum
        Konto hinzu. Benutzername, Beiträge und Teile der Versionshistorie
        können öffentlich sichtbar sein.
      </p>
      <p>
        Diese Verarbeitung dient der Bereitstellung des Kontos, der
        Veröffentlichung und der Nachvollziehbarkeit von Beiträgen. Für
        beantragte Kontofunktionen kommt im Beispiel Art. 6 Abs. 1 Buchst. b
        DSGVO in Betracht. Die Speicherfristen für Konten, Beiträge,
        Versionshistorien und Sicherungskopien sind vor Veröffentlichung zu
        ergänzen.
      </p>
    </Section>

    <Section heading="Cookies">
      <ul>
        <li>
          <code>auth</code> hält die Anmeldung aufrecht. Das Cookie wird bei der
          Anmeldung oder Registrierung gesetzt, läuft nach sieben Tagen ab
          und wird beim Abmelden im Browser gelöscht.
        </li>
        <li>
          <code>{LANGUAGE_COOKIE}</code> speichert die ausdrücklich gewählte
          Sprache der Oberfläche für {LANGUAGE_COOKIE_DAYS} Tage. Die
          Sprachauswahl in der Fußzeile ändert den gespeicherten Wert. Das
          Cookie lässt sich in den Browsereinstellungen löschen.
        </li>
      </ul>
      <p>
        Die Cookies dienen den gewählten Funktionen. Für das Speichern und
        Auslesen kommt insoweit § 25 Abs. 2 Nr. 2 TDDDG in Betracht. Ob
        Cloudflare je nach Konfiguration weitere Cookies setzt, ist vor
        Veröffentlichung anhand der aktiven Funktionen zu prüfen.
      </p>
    </Section>

    <Section heading="Externe Bilder">
      <p>
        Beim Aufruf bestimmter Seiten lädt der Browser Platzhalterbilder von
        <code> placehold.co</code> und Profilbilder von
        <code> api.dicebear.com</code>. Dabei wird die IP-Adresse an den
        jeweiligen Dienst übermittelt. Bei Profilbildern enthält die
        Anfrage außerdem den öffentlichen Benutzernamen als Grundlage
        für die Erzeugung des Bildes.
      </p>
    </Section>

    <Section heading="Geplante Reichweitenmessung">
      <p>
        Eine spätere Reichweitenmessung mit Umami ohne Analyse-Cookies ist
        geplant. Umami ist derzeit in WikiBricks nicht eingebunden. Vor
        Aktivierung sind Betriebsart, Datenkategorien, Rechtsgrundlage,
        Empfänger und Speicherfrist in dieser Erklärung zu ergänzen.
      </p>
    </Section>

    <Section heading="Betroffenenrechte">
      <p>
        Nach Maßgabe der DSGVO bestehen Rechte auf Auskunft, Berichtigung,
        Löschung, Einschränkung der Verarbeitung und Datenübertragbarkeit.
        Gegen eine Verarbeitung auf Grundlage berechtigter Interessen kann
        unter den Voraussetzungen von Art. 21 DSGVO Widerspruch eingelegt
        werden. Außerdem besteht das Recht auf Beschwerde bei einer
        Datenschutzaufsichtsbehörde.
      </p>
    </Section>
  </>);

export const handleTermsPage = (c: DefaultContext) =>
  renderLegalPage(c, "Nutzungsbedingungen", <>
    <Section heading="Nutzung von WikiBricks">
      <p>
        WikiBricks ist ein gemeinschaftliches Nachschlagewerk über Klemmbausteine.
        Einträge können gelesen werden. Ein Konto ermöglicht es, neue Einträge
        und Änderungen vorzuschlagen und Bilder hochzuladen.
      </p>
    </Section>

    <Section heading="Konto und Beiträge">
      <p>
        Halten Sie Ihre Zugangsdaten vertraulich. Veröffentlichen Sie nur
        Inhalte, die Sie selbst erstellt haben oder für die Sie die nötigen
        Rechte besitzen. Vermeiden Sie rechtswidrige, beleidigende oder
        irreführende Beiträge, Spam und die unbefugte Veröffentlichung
        personenbezogener Daten.
      </p>
      <p>
        Beiträge werden dem Benutzernamen zugeordnet. Vorschläge und
        frühere Fassungen können über Versionslinks oder die
        Versionshistorie einsehbar sein.
      </p>
    </Section>

    <Section heading="Lizenz und Weiterverwendung">
      <p>
        Dieser Beispielentwurf sieht für eigene veröffentlichte Beiträge die
        Lizenz <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.de">CC BY-SA 4.0</a> vor,
        soweit am Inhalt keine andere Lizenz angegeben ist. Bestätigen Sie
        die Lizenzfassung vor Veröffentlichung dieser Bedingungen. Beachten
        Sie bei der Weiterverwendung die Lizenz- und Rechtehinweise am
        jeweiligen Inhalt.
      </p>
    </Section>

    <Section heading="Moderation und Meldungen">
      <p>
        Moderatorinnen und Moderatoren können Vorschläge prüfen, freigeben
        oder ablehnen. Wenn Sie einen möglicherweise rechtswidrigen
        Beitrag melden möchten, geben Sie die genaue Seitenadresse und
        den Grund Ihrer Meldung an. Die Kontaktdaten finden Sie im{" "}
        <a href="/impressum">Impressum</a>.
      </p>
    </Section>
  </>);

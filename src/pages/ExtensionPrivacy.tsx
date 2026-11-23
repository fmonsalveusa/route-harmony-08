import { SUPPORT_EMAIL } from './DeleteData';

// Política de privacidad de la extensión de Chrome "Dispatch Up – Dispatcher Tools"
// (tools/dat-tab-names). La pide la Chrome Web Store: dispatch-up.com/extension-privacy
const ExtensionPrivacy = () => {
  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto prose prose-sm dark:prose-invert">
        <h1>Privacy Policy — Dispatch Up Dispatcher Tools (Chrome extension)</h1>
        <p className="text-muted-foreground">Last updated: November 23, 2026</p>

        <p>
          Dispatch Up Dispatcher Tools is an internal tool used by the dispatchers of 58 Logistics LLC and
          companies using the Dispatch Up TMS. It adds helpers to the load board pages the user already has
          open. It is not affiliated with or endorsed by DAT Solutions or RTS Financial.
        </p>

        <h2>1. What the extension uses</h2>
        <ul>
          <li><strong>Load board page data (one.dat.com, iq.prod.dat.com):</strong> the loads, broker names, MC numbers, contact emails and market data that the page itself loads for the signed-in user. It is used only inside the browser to show the driver name on each search tab, the broker's credit rating, the market of the destination city and to prefill the broker email.</li>
          <li><strong>RTS session (rtspro.com):</strong> while the user is signed in to RTS, the extension reuses that session to look up a broker's credit rating by MC number. The session token stays in the browser's local extension storage and is never sent to Dispatch Up or anyone else.</li>
          <li><strong>Broker emails:</strong> when the user clicks "Email", the recipient, subject and body of that email (built from the user's template and the load details) are sent to the Dispatch Up server, which delivers it from the company mailbox and keeps a log (date, recipient, load) so the team knows the broker was already contacted.</li>
          <li><strong>Settings:</strong> the email template, the Dispatch Up access key and the driver names for each search tab are stored in Chrome's extension storage.</li>
        </ul>

        <h2>2. What we do not do</h2>
        <ul>
          <li>We do not sell or share data with third parties.</li>
          <li>We do not use the data for advertising or profiling.</li>
          <li>We do not collect browsing history or data from websites other than the load board, RTS and Google Voice pages listed above.</li>
          <li>We do not read or store passwords.</li>
        </ul>

        <h2>3. Where data goes</h2>
        <ul>
          <li>RTS (stc-debtor-service.rtspro.com): MC number or broker name, to get its credit rating.</li>
          <li>Dispatch Up (tejzatzzwivvaznxyqej.supabase.co, dispatch-up.com): broker emails sent by the user and the check for a newer extension version.</li>
          <li>Google Voice (voice.google.com): the phone number the user clicks to call.</li>
        </ul>
        <p>All connections use HTTPS.</p>

        <h2>4. Retention and deletion</h2>
        <p>Data stored in the browser is removed when the extension is uninstalled. Sent-email logs are kept in the company's Dispatch Up account and can be deleted on request.</p>

        <h2>5. Contact</h2>
        <p>
          <strong>Dispatch Up</strong> — 58 Logistics LLC<br />
          Email: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </div>
    </div>
  );
};

export default ExtensionPrivacy;

// Página pública para pedir el borrado de la cuenta y los datos (la exige Google Play en Data safety)
export const SUPPORT_EMAIL = '58logisticsllc@gmail.com';

const DeleteData = () => {
  const subject = encodeURIComponent('Dispatch Up Driver - Delete my account and data');
  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto prose prose-sm dark:prose-invert">
        <h1>Delete your Dispatch Up Driver account and data</h1>
        <p className="text-muted-foreground">Dispatch Up Driver · 58 Logistics LLC</p>

        <p>
          Dispatch Up Driver accounts are created by the trucking company you work with. You can ask us at any time to delete your
          account and the personal data linked to it.
        </p>

        <h2>How to request deletion</h2>
        <ol>
          <li>
            Send an email to <a href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`}>{SUPPORT_EMAIL}</a> with the subject
            <strong> "Delete my account and data"</strong>.
          </li>
          <li>Include your full name, the email you use to sign in to the app and your phone number, so we can find your account.</li>
          <li>We will confirm the request by email and complete it within 30 days.</li>
        </ol>

        <h2>What is deleted</h2>
        <ul>
          <li>Your app sign-in account (email and password).</li>
          <li>Your location history (GPS points collected during loads).</li>
          <li>Your profile: name, phone number, address, emergency contact and bank details.</li>
          <li>Your uploaded personal documents: driver's license, medical card and other personal files.</li>
        </ul>

        <h2>What is kept, and for how long</h2>
        <ul>
          <li>
            Load records, bills of lading (BOL), proof of delivery (POD) and load pictures, because they belong to shipments made for
            brokers and customers: kept up to 3 years.
          </li>
          <li>Payment, settlement and tax records (including 1099 information), as required by tax law: kept up to 7 years.</li>
        </ul>
        <p>After these periods the remaining records are deleted.</p>

        <p>
          See also our <a href="/privacy-policy">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
};

export default DeleteData;

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto prose prose-sm dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: February 21, 2026</p>

        <h2>1. Information We Collect</h2>
        <p>Dispatch Up collects the following information to provide our transportation management services:</p>
        <ul>
          <li><strong>Account Information:</strong> Name, email address, phone number, and company details when you create an account.</li>
          <li><strong>Location Data:</strong> GPS location data from drivers who opt-in to real-time tracking for load delivery purposes.</li>
          <li><strong>Documents:</strong> Driver's license, medical card, insurance documents, and other transportation-related documents uploaded for compliance purposes.</li>
          <li><strong>Load & Payment Data:</strong> Information about loads, routes, payments, and invoices processed through the platform.</li>
          <li><strong>Device Information:</strong> Device type, operating system, and app version for technical support.</li>
          <li><strong>Camera:</strong> Photos of documents and proof of delivery (POD) when you choose to use the camera feature.</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>We use collected information to:</p>
        <ul>
          <li>Provide and improve our transportation management services</li>
          <li>Process payments and generate invoices</li>
          <li>Enable real-time tracking for load deliveries</li>
          <li>Verify driver compliance and documentation</li>
          <li>Communicate important updates about your account and loads</li>
          <li>Ensure the security of our platform</li>
        </ul>

        <h2>3. Information Sharing</h2>
        <p>We do not sell your personal information. We may share information with:</p>
        <ul>
          <li>Your employer or dispatching company (as part of the service)</li>
          <li>Service providers who assist in operating our platform</li>
          <li>Law enforcement when required by law</li>
        </ul>

        <h2>4. Location Data</h2>
        <p>Location tracking is used solely for load delivery tracking purposes. Drivers can control location sharing through the app. Location data is shared only with the driver's assigned dispatching company and is not sold to third parties.</p>

        <h2>5. Data Security</h2>
        <p>We implement industry-standard security measures including encryption, secure data storage, and access controls to protect your information. All data is transmitted over encrypted connections (HTTPS/TLS).</p>

        <h2>6. Data Retention</h2>
        <p>We retain your data for as long as your account is active or as needed to provide our services. You may request deletion of your account and associated data by contacting us.</p>

        <h2>7. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access your personal data</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Opt-out of location tracking</li>
          <li>Withdraw consent at any time</li>
        </ul>

        <h2>8. Children's Privacy</h2>
        <p>Our service is not intended for individuals under 18 years of age. We do not knowingly collect personal information from children.</p>

        <h2>9. Changes to This Policy</h2>
        <p>We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.</p>

        <h2>10. Contact Us</h2>
        <p>If you have questions about this privacy policy or our data practices, please contact us at:</p>
        <p>
          <strong>Dispatch Up</strong><br />
          Email: support@dispatchup.com
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

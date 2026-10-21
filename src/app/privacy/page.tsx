export const dynamic = 'force-dynamic';

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-gray-50 flex-1">
      <div className="py-8 px-4 sm:px-6 md:px-8 max-w-[1440px] mx-auto w-full">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Privacy Policy</h1>

          <div className="prose prose-lg max-w-none">

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4 capitalize">Information on the handling of personal data</h2>
              <p className="text-gray-600 mb-4">
                We are very pleased about your interest in our website - and thus in our company.
                The protection of your private rights and freedoms is very important to us; we only
                use your data for the purposes intended. Since it is important to us that you are
                aware at all times of the extent to which we collect, use and, if necessary,
                transfer your data to third parties, we will provide you with the following
                comprehensive information on the processing of your personal data collected by us
                or stored by us.
              </p>
              <p className="text-gray-600 mb-4">
                In principle, you can use our pages without providing any data; if there are any
                exceptions to this for selected services, we will explain these in the following
                chapters. When processing personal data, we strictly adhere to the requirements
                of the EU General Data Protection Regulation (GDPR) and any other data protection
                regulations.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4 capitalize">Name and address of the controller</h2>
              <div className="bg-white p-6 px-8 rounded-lg w-fit">
                <p className="text-gray-800 font-medium">Mapp Digital Germany GmbH</p>
                <p className="text-gray-600">Sandstr. 3</p>
                <p className="text-gray-600">80335 München</p>
                <p className="text-gray-600">Germany</p>
                <p className="text-gray-600 mt-2">
                  E-mail: <a href="mailto:info@mapp.com" className="text-primary-600 hover:text-primary-800">info@mapp.com</a>
                </p>
                <p className="text-gray-600">
                  Website: <a href="https://mapp.com" className="text-primary-600 hover:text-primary-800" target="_blank" rel="noopener noreferrer">https://mapp.com</a>
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4 capitalize">Contact details of the data protection officer</h2>
              <p className="text-gray-600 mb-4">
                Contact our Privacy Team: <a href="mailto:privacy@mapp.com" className="text-primary-600 hover:text-primary-800">privacy@mapp.com</a>.
                Alternatively, you can reach out to our data protection officer directly: <a href="mailto:data-protection-officer@mapp.com" className="text-primary-600 hover:text-primary-800">data-protection-officer@mapp.com</a>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Data Collection</h2>
              <p className="text-gray-600 mb-4">
                We collect information you provide directly to us, such as when you create an
                account or contact us for support.
              </p>
            </section>

          </div>
      </div>
    </div>
  );
}

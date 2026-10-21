import { Metadata } from 'next';
import Card from '@/components/ui/Card';
import Icon from '@/components/ui/Icon';
import { pageTitle } from '@/lib/utils/metadata';

export const metadata: Metadata = {
  title: pageTitle('Contact Support'),
  description: 'Get in touch with our support team for assistance with your account and services.',
};

export default function ContactPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Contact Support</h1>
        <p className="text-lg text-gray-600 mx-auto">
          Our support team is here to help you with any questions or issues you may have.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Contact Options */}
        <Card title="Get Help">
          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <Icon type="mail" className="text-primary-600" size="lg" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Email Support</h3>
                <p className="text-gray-600 mb-2">
                  Send us an message and we&apos;ll get back to you ASAP.
                </p>
                <a 
                  href="https://mapp.com/contact-us/" 
                  className="text-primary-600 hover:text-primary-800 font-medium"
                >
                  Contact Us Page
                </a>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <Icon type="info" className="text-primary-600" size="lg" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Documentation</h3>
                <p className="text-gray-600 mb-2">
                  Find answers to common questions in our knowledge base.
                </p>
                <a 
                  href="https://docs.mapp.com" 
                  className="text-primary-600 hover:text-primary-800 font-medium"
                >
                  Browse Documentation
                </a>
              </div>
            </div>
          </div>
        </Card>

        {/* Quick Actions */}
        <Card title="Quick Actions">
          <div className="space-y-4">
          <p className="text-gray-600">
            To help us assist you more efficiently, please have the following information ready:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-600 ml-4">
            <li>Your account email address</li>
            <li>A detailed description of the issue you&apos;re experiencing</li>
            <li>Any error messages you&apos;ve encountered</li>
            <li>Screenshots or screen recordings if applicable</li>
            <li>Steps you&apos;ve already taken to try to resolve the issue</li>
          </ul>
        </div>
        </Card>
      </div>

    </div>
  );
}
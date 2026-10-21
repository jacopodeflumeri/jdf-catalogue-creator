'use client';

import { useEffect } from 'react';
import MemberCard from '@/components/shared/user/MemberCard';
import Icon from '@/components/ui/Icon';
import { useCustomerAccount } from '@/components/providers/CustomerAccountProvider';
import type { Session } from 'next-auth';
import { logger } from '@/lib/utils/logger';

interface CustomerDashboardClientProps {
  user: any;
  team: any;
  mappTeam: any[];
  session: Session;
}

const CustomerDashboardClient: React.FC<CustomerDashboardClientProps> = ({
  user: _user,
  mappTeam
}) => {


  const { customerAccount } = useCustomerAccount();

  // Debug: Log account stage for testing
  useEffect(() => {
    if (customerAccount) {
      logger.log('Customer Account Stage:', customerAccount.stage);
      logger.log('Customer Account Status:', customerAccount.status);
    }
  }, [customerAccount]);

  // Function to handle smooth scrolling with offset for floating menu
  const _scrollToSection = (targetId: string) => {
    const element = document.getElementById(targetId);
    if (element) {
      const offsetTop = element.offsetTop - 100; // Adjust offset as needed for floating menu
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      });
    }
  };

  return (
    <>
      <div className='relative'>

        {/* Welcome Message */}
        <div className="bg-gradient-to-br from-primary-50 to-secondary-50 border-b border-gray-200">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Icon type="user" size="lg" className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Welcome back{customerAccount?.name ? `, ${customerAccount.name}` : ''}!
                </h1>
                <p className="text-lg text-gray-600 mt-1">
                  Your Mapp Labs dashboard - manage your account and explore your team
                </p>
              </div>
            </div>
          </div>
        </div>

        

        {/* Dedicated Team Section */}
        {mappTeam && mappTeam.length > 0 && (
          <div className="bg-gradient-to-br from-background-400 to-background-500" id="team-section">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid lg:grid-cols-2 gap-12 items-start">
                {/* Left side - Text content */}
                <div className="space-y-6 py-16">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">
                      Your Dedicated Mapp Team
                    </h2>
                    <p className="text-lg text-gray-600 mb-6">
                      Meet the experts who are committed to your success. Our dedicated team provides personalized support, strategic guidance, and technical expertise to help you maximize your marketing potential.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <Icon type="check-circle" size="sm" className="text-primary-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Strategic Consultation</h3>
                        <p className="text-gray-600 text-sm">Get expert advice on campaign optimization and marketing strategy.</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <Icon type="headphones" size="sm" className="text-primary-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Technical Support</h3>
                        <p className="text-gray-600 text-sm">Assistance for any technical questions or issues.</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <Icon type="trending-up" size="sm" className="text-primary-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Performance Optimization</h3>
                        <p className="text-gray-600 text-sm">Ongoing analysis and recommendations to improve your results.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right side - Scrollable team member cards */}
                <div className="relative flex flex-col gap-4 align-right justify-start items-end max-h-[600px] overflow-y-auto py-16 pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                  {mappTeam.map((member: any) => (
                    <MemberCard
                      key={member.id || member.email || member.name}
                      member={member}
                      showActions={false}
                      size="lg"
                      style="primary"
                      className="w-[400px]"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );

};

export default CustomerDashboardClient;
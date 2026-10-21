'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Loading from '@/components/ui/Loading';
import FormInput from '@/components/ui/form/FormInput';
import FormSelect from '@/components/ui/form/FormSelect';
import S3ImageUpload from '@/modules/s3_images/components/S3ImageUpload';
import { useToast } from '@/components/providers/ToastProvider';
import { useUserProfile } from '@/components/providers/UserProfileProvider';
import { updateMappTeamMember } from '@/lib/actions/admin/admin-actions';
import type { MappTeamResponse, MappTeamMemberRequest, S3Image } from '@/types';
import logger from '@/lib/utils/logger';

interface AdminUserClientProps {
  initialData: MappTeamResponse | null;
}

export default function AdminUserClient({ initialData }: AdminUserClientProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const { updateUserProfile } = useUserProfile();
  const [user] = useState<MappTeamResponse | null>(initialData);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [formData, setFormData] = useState<MappTeamMemberRequest>({
    email: initialData?.email || '',
    firstname: initialData?.firstname || '',
    lastname: initialData?.lastname || '',
    title: initialData?.title || '',
    role: initialData?.role || '',
    location: initialData?.location || undefined,
    image: initialData?.image || undefined,
  });

  // Role options for the select dropdown
  const roleOptions = [
    { value: 'Solution Consultant', label: 'Solution Consultant' },
    { value: 'Solution Engineer', label: 'Solution Engineer' },
    { value: 'Solution Architect', label: 'Solution Architect' },
    { value: 'Solutions', label: 'Solutions' },
    { value: 'Customer Success', label: 'Customer Success' },
    { value: 'Sales', label: 'Sales' },
    { value: 'Strategy', label: 'Strategy' },
  ];

  const handleInputChange = (field: keyof MappTeamMemberRequest, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageChange = (s3Image: S3Image | null) => {
    logger.log('handleImageChange called with:', { s3Image, currentPreview: previewImage, currentImage: formData.image });

    if (s3Image) {
      setPreviewImage(null); // Clear preview since we'll show the uploaded image
      setFormData(prev => ({
        ...prev,
        image: s3Image
      }));
    } else {
      setPreviewImage(null);
      setFormData(prev => ({
        ...prev,
        image: undefined // Clear existing image reference
      }));
    }
  };

  const handleImageUploadStateChange = (isUploading: boolean) => {
    setIsImageUploading(isUploading);
  };

  const handleSave = async () => {
    if (!user?.id) return;

    // Check if image upload is in progress
    if (isImageUploading) {
      addToast({ 
        type: 'warning', 
        message: 'Please wait for the image upload to complete before saving.' 
      });
      return;
    }

    setError(null);
    
    startTransition(async () => {
      try {
        const updatedUser = await updateMappTeamMember(user.id.toString(), formData);
        
        // Update the user profile context to refresh the navigation header
        if (updatedUser) {
          updateUserProfile(updatedUser);
          
          // Update the form data with the server response to reflect the new image
          setFormData({
            email: updatedUser.email || '',
            firstname: updatedUser.firstname || '',
            lastname: updatedUser.lastname || '',
            title: updatedUser.title || '',
            role: updatedUser.role || '',
            location: updatedUser.location || undefined,
            image: updatedUser.image || undefined,
          });
        }
        
        // Clear the preview image since it's now saved
        setPreviewImage(null);
        
        addToast({
          type: 'success',
          message: 'Profile updated successfully!'
        });
      } catch (err) {
        logger.error('Error updating user:', err);
        setError('Failed to update profile. Please try again.');
        addToast({
          type: 'error',
          message: 'Failed to update profile'
        });
      }
    });
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        title: user.title,
        role: user.role,
        location: user.location || undefined,
        image: user.image || undefined      
      });
      setPreviewImage(null);
    }
    router.push('/admin');
  };

  const handleSignOut = async () => {
    window.location.href = '/auth/signout?callbackUrl=%2Fauth%2Fadmin';
  };

  const handleRetry = () => {
    // Clear error and try to navigate back to dashboard, then back to profile
    setError(null);
    router.refresh();
  };

  if (error && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md p-6">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">❌</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Profile</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="flex space-x-3 justify-center">
              <Button onClick={handleRetry}>
                Try Again
              </Button>
              <Button variant="outline" onClick={() => router.push('/admin')}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading size="lg" text="Loading profile..." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">User Profile</h1>
          <p className="text-gray-500 text-lg">
        Manage your admin profile information and settings.
          </p>
        </div>

        <Button variant="outline" onClick={handleSignOut}>
          Sign Out
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <div className="grid gap-8">
        {/* Profile Information */}
        <Card>
          <div className="space-y-8">
            {/* Profile Picture Section */}
            <div className="flex items-center space-x-6">
              <S3ImageUpload
                value={formData.image}
                preview={previewImage}
                onChange={handleImageChange}
                onUploadStateChange={handleImageUploadStateChange}
                variant="circle"
                size="md"
                acceptedTypes={['image/*']}
                maxSize={5}
                placeholder={
                  <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                    {formData.firstname?.charAt(0) || ''}{formData.lastname?.charAt(0) || ''}
                  </div>
                }
              />
              
              <div className="flex-1 space-y-2">
                <h3 className="text-lg font-semibold text-gray-900 m-0">
                  {formData.firstname} {formData.lastname}
                </h3>
                <p className="text-gray-600">{formData.email}</p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormInput
                id="firstname"
                name="firstname"
                label="First Name"
                value={formData.firstname}
                onChange={(e) => handleInputChange('firstname', e.target.value)}
                placeholder="Enter first name"
                className="px-4 py-3 rounded-xl"
              />

              <FormInput
                id="lastname"
                name="lastname"
                label="Last Name"
                value={formData.lastname}
                onChange={(e) => handleInputChange('lastname', e.target.value)}
                placeholder="Enter last name"
                className="px-4 py-3 rounded-xl"
              />

              <FormInput
                id="title"
                name="title"
                label="Job Title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Enter job title"
                className="px-4 py-3 rounded-xl"
              />

              <FormSelect
                id="role"
                name="role"
                label="Role"
                value={formData.role}
                onChange={(e) => handleInputChange('role', e.target.value)}
                options={roleOptions}
                placeholder="Select a role"
                className="px-4 py-3 rounded-xl"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 sm:justify-between">
              <Button variant="outline" onClick={handleCancel} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={isPending || isImageUploading}
                className="w-full sm:w-auto"
              >
                {isPending ? 'Saving...' : isImageUploading ? 'Uploading image...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

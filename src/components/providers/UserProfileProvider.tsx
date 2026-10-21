/**
 * Simplified User Profile Context
 * 
 * Now that user profile data is fetched server-side and passed as props,
 * this context only manages local state updates and provides a way for
 * components to update the profile data optimistically.
 */

'use client';

import React, { createContext, useContext, useState } from 'react';
import type { MappTeamResponse } from '@/types';

interface UserProfileContextType {
  userProfile: MappTeamResponse | null;
  updateUserProfile: (profile: MappTeamResponse | null) => void;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
};

interface UserProfileProviderProps {
  children: React.ReactNode;
  initialProfile?: MappTeamResponse | null;
}

export const UserProfileProvider: React.FC<UserProfileProviderProps> = ({ 
  children, 
  initialProfile = null
}) => {
  const [userProfile, setUserProfile] = useState<MappTeamResponse | null>(initialProfile);

  const updateUserProfile = (profile: MappTeamResponse | null) => {
    setUserProfile(profile);
  };

  const value: UserProfileContextType = {
    userProfile,
    updateUserProfile,
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
};

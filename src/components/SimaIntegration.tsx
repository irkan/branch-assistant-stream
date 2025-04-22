import React from 'react';

// Sima API Response interface
export interface SimaResponse {
  firstName: string;
  lastName: string;
  birthdate: string;
  sex: 'male' | 'female';
}

// Mock Sima API
export const mockSimaAPI = async (faceImage: string): Promise<SimaResponse> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Mock database of users
  const users: SimaResponse[] = [
    {
      firstName: "İrkan",
      lastName: "Əhmədov",
      birthdate: "25.09.1989", 
      sex: "male"
    },
    {
      firstName: "Aytən",
      lastName: "Məmmədova",
      birthdate: "12.04.1991", 
      sex: "female"
    },
    {
      firstName: "Elşən",
      lastName: "Hüseynov",
      birthdate: "05.07.1985", 
      sex: "male"
    },
    {
      firstName: "Gülnar",
      lastName: "Əliyeva",
      birthdate: "18.11.1990", 
      sex: "female"
    }
  ];
  
  // Randomly select a user from the mock database
  // In a real implementation, this would be based on the actual face recognition
  const randomIndex = Math.floor(Math.random() * users.length);
  return users[randomIndex];
};

// Generate greeting based on user data
export const generateGreeting = (userData: SimaResponse): string => {
  if (userData.sex === 'male') {
    return `Salam ${userData.firstName} bəy, Xoş gəlmisiniz. Sizə necə dəstək ola bilərəm?`;
  } else {
    return `Salam ${userData.firstName} xanım, xoş gəlmisiniz. Sizə necə kömək ola bilərəm?`;
  }
};

// Convert canvas to base64 image
export const canvasToBase64 = (canvas: HTMLCanvasElement): string => {
  return canvas.toDataURL('image/jpeg');
};

const SimaIntegration: React.FC = () => {
  // This component doesn't render anything
  return null;
};

export default SimaIntegration; 
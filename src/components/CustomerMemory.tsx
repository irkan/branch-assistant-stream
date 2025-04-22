import React, { useState, useEffect } from 'react';

interface CustomerData {
  id: string;
  faceDescriptor: Float32Array;
  lastSeen: number;
  conversations: {
    timestamp: number;
    userMessage: string;
    aiResponse: string;
  }[];
}

interface CustomerMemoryProps {
  onCustomerIdentified: (customer: CustomerData, isNew: boolean) => void;
}

const CustomerMemory: React.FC<CustomerMemoryProps> = ({ onCustomerIdentified }) => {
  // Local storage key
  const STORAGE_KEY = 'branch_assistant_customers';
  
  // Time threshold for greeting returning customers (30 minutes in milliseconds)
  const TIME_THRESHOLD = 30 * 60 * 1000;
  
  // Load customers from local storage
  const loadCustomers = (): CustomerData[] => {
    try {
      const storedData = localStorage.getItem(STORAGE_KEY);
      if (storedData) {
        // Parse stored data and convert descriptor arrays back to Float32Array
        const parsedData = JSON.parse(storedData);
        return parsedData.map((customer: any) => ({
          ...customer,
          faceDescriptor: new Float32Array(Object.values(customer.faceDescriptor))
        }));
      }
    } catch (error) {
      console.error('Error loading customers from storage:', error);
    }
    return [];
  };
  
  // Save customers to local storage
  const saveCustomers = (customers: CustomerData[]) => {
    try {
      // Convert Float32Array to regular objects for JSON serialization
      const serializedCustomers = customers.map(customer => ({
        ...customer,
        faceDescriptor: Array.from(customer.faceDescriptor)
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializedCustomers));
    } catch (error) {
      console.error('Error saving customers to storage:', error);
    }
  };
  
  // Add or update customer
  const addOrUpdateCustomer = (faceDescriptor: Float32Array, euclideanDistance: (a: Float32Array, b: Float32Array) => number): [CustomerData, boolean] => {
    const customers = loadCustomers();
    const currentTime = Date.now();
    
    // Check if customer already exists
    let existingCustomer: CustomerData | undefined;
    let isNew = true;
    
    for (const customer of customers) {
      const distance = euclideanDistance(faceDescriptor, customer.faceDescriptor);
      
      // If distance is below threshold, consider it a match
      if (distance < 0.6) {
        existingCustomer = customer;
        isNew = false;
        break;
      }
    }
    
    // If customer exists, update last seen time
    if (existingCustomer) {
      existingCustomer.lastSeen = currentTime;
      saveCustomers(customers);
      
      // Determine if we should treat as new (if returning after threshold)
      const shouldGreetAsNew = existingCustomer.lastSeen < currentTime - TIME_THRESHOLD;
      return [existingCustomer, shouldGreetAsNew];
    }
    
    // If new customer, create and save
    const newCustomer: CustomerData = {
      id: `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      faceDescriptor,
      lastSeen: currentTime,
      conversations: []
    };
    
    customers.push(newCustomer);
    saveCustomers(customers);
    
    return [newCustomer, true];
  };
  
  // Add conversation to customer history
  const addConversation = (customerId: string, userMessage: string, aiResponse: string) => {
    const customers = loadCustomers();
    const customerIndex = customers.findIndex(c => c.id === customerId);
    
    if (customerIndex !== -1) {
      customers[customerIndex].conversations.push({
        timestamp: Date.now(),
        userMessage,
        aiResponse
      });
      
      saveCustomers(customers);
    }
  };
  
  // Get customer conversation history
  const getConversationHistory = (customerId: string): string[] => {
    const customers = loadCustomers();
    const customer = customers.find(c => c.id === customerId);
    
    if (customer && customer.conversations.length > 0) {
      // Format conversations as strings
      return customer.conversations.map(conv => 
        `Müştəri: ${conv.userMessage}. Ayla: ${conv.aiResponse}`
      );
    }
    
    return [];
  };
  
  // Clean up old customers (optional, for privacy/storage concerns)
  const cleanupOldCustomers = (daysThreshold: number = 30) => {
    const customers = loadCustomers();
    const currentTime = Date.now();
    const timeThreshold = daysThreshold * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    
    const activeCustomers = customers.filter(
      customer => customer.lastSeen > currentTime - timeThreshold
    );
    
    if (activeCustomers.length !== customers.length) {
      saveCustomers(activeCustomers);
    }
  };
  
  // Run cleanup on component mount
  useEffect(() => {
    cleanupOldCustomers();
  }, []);
  
  return null; // This is a utility component, no UI needed
};

export default CustomerMemory;

// Export utility functions for use in other components
export const CustomerMemoryUtils = {
  STORAGE_KEY: 'branch_assistant_customers',
  TIME_THRESHOLD: 30 * 60 * 1000,
  
  loadCustomers(): CustomerData[] {
    try {
      const storedData = localStorage.getItem(this.STORAGE_KEY);
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        return parsedData.map((customer: any) => ({
          ...customer,
          faceDescriptor: new Float32Array(Object.values(customer.faceDescriptor))
        }));
      }
    } catch (error) {
      console.error('Error loading customers from storage:', error);
    }
    return [];
  },
  
  saveCustomers(customers: CustomerData[]) {
    try {
      const serializedCustomers = customers.map(customer => ({
        ...customer,
        faceDescriptor: Array.from(customer.faceDescriptor)
      }));
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(serializedCustomers));
    } catch (error) {
      console.error('Error saving customers to storage:', error);
    }
  },
  
  addConversation(customerId: string, userMessage: string, aiResponse: string) {
    const customers = this.loadCustomers();
    const customerIndex = customers.findIndex(c => c.id === customerId);
    
    if (customerIndex !== -1) {
      customers[customerIndex].conversations.push({
        timestamp: Date.now(),
        userMessage,
        aiResponse
      });
      
      this.saveCustomers(customers);
    }
  },
  
  getConversationHistory(customerId: string): string[] {
    const customers = this.loadCustomers();
    const customer = customers.find(c => c.id === customerId);
    
    if (customer && customer.conversations.length > 0) {
      return customer.conversations.map(conv => 
        `Müştəri: ${conv.userMessage}. Ayla: ${conv.aiResponse}`
      );
    }
    
    return [];
  }
};

export type { CustomerData };

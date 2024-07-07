"use client";

import { Agency, Contact, User } from "@prisma/client";
import React, { createContext, useContext, useEffect, useState } from "react";

// Props passed into it
// Just the children
interface ModalProviderProps {
  children: React.ReactNode;
}

// Data inside the context
export type ModalData = {
  user?: User;
  agency?: Agency;
};

//
type ModalContextType = {
  data: ModalData;
  isOpen: boolean;
  setOpen: (modal: React.ReactNode, fetchData?: () => Promise<any>) => void;
  setClose: () => void;
};

// From reacts createContext function
// Anything in {value} can be read from any component, no matter how deep
export const ModalContext = createContext<ModalContextType>({
  data: {}, // Data of whatever the modal will hold
  isOpen: false,

  //fetchData is a function that gives a way of collecting the data
  setOpen: (modal: React.ReactNode, fetchData?: () => Promise<any>) => {},
  setClose: () => {},
});

const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<ModalData>({});
  const [showingModal, setShowingModal] = useState<React.ReactNode>(null);
  const [isMounted, setIsMounted] = useState(false);

  // This is used to return null when the component is not mounted
  // Common pattern to prevent some hydration errors
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Redefine the setOpen value
  const setOpen = async (
    modal: React.ReactNode,
    fetchData?: () => Promise<any>
  ) => {
    if (modal) {
      if (fetchData) {
        setData({ ...data, ...(await fetchData()) } || {});
      }
      // Modal that will be rendered
      // We do not need to clear this as setIsOpen will change
      setShowingModal(modal);
      setIsOpen(true);
    }
  };

  // Define the setClose value
  const setClose = () => {
    setIsOpen(false);
    setData({});
  };

  // Render null whwn not mounted, otherwise render the code
  if (!isMounted) return null;

  return (
    //value --> All components inside this prop can read value
    <ModalContext.Provider value={{ data, setOpen, setClose, isOpen }}>
      {children}
      {showingModal}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);

  if (!context) {
    throw new Error("useModal must be used within the modal provider");
  }

  return context;
};

export default ModalProvider;

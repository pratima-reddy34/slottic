"use client";
import React, { useState, useEffect, type FormEvent, useCallback } from "react";
import { doc, setDoc, serverTimestamp, query, collection, where, limit, getDocs as getFirestoreDocs } from "firebase/firestore";
import { db } from '@/lib/firebase/config';
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Trash2, Image as ImageIcon, CalendarDays, MapPinIcon, UsersIcon, Clock, Coffee as CoffeeIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
interface CafeProfileFormData {
  id?: string;
  name: string;
  personName: string;
  location: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  capacity: number;
  availability: string;
  preferredTimeSlots: string;
  imageUrls: string[];
  imageHint: string;
  facilities: string[];
  ambienceType: string;
  houseRules: string;
  socialLinks: {
    instagram: string;
    facebook: string;
    website: string;
  };
  createdAt?: any;
  updatedAt?: any;
  managerId?: string;
}
const initialFormData: CafeProfileFormData = {
  name: "",
  personName: "",
  location: "",
  description: "",
  contactEmail: "",
  contactPhone: "",
  capacity: 0,
  availability: "",
  preferredTimeSlots: "",
  imageUrls: [],

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
  imageHint: "cafe interior",
  facilities: [],
  ambienceType: "",
  houseRules: "",
  socialLinks: { instagram: "", facebook: "", website: "" },
};
const allFacilities = ["Wi-Fi", "Sound System", "Microphone", "Projector", "Stage", "Outdoor Seating", "Parking"];
export default function CafeManagerProfileForm() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState<CafeProfileFormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const fetchCafeProfile = useCallback(async () => {
    if (!user || !userProfile || userProfile.role !== 'cafe_manager') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const cafeQuery = query(collection(db, "cafes"), where("managerId", "==", user.uid), limit(1));
      const cafeSnapshot = await getFirestoreDocs(cafeQuery);
      if (!cafeSnapshot.empty) {
        const cafeDoc = cafeSnapshot.docs[0];
        const cafeData = cafeDoc.data() as Partial<CafeProfileFormData>;
        setFormData({
          ...initialFormData,
          ...cafeData,
          id: cafeDoc.id,
          managerId: cafeData.managerId || user.uid,
          personName: cafeData.personName || userProfile.name || "",
          contactEmail: cafeData.contactEmail || user.email || "",
          contactPhone: cafeData.contactPhone || userProfile.phone || "",
        });
      } else {
        setFormData(prev => ({
          ...prev,
          personName: userProfile?.name || "",
          contactEmail: user.email || "",
          contactPhone: userProfile?.phone || "",
          managerId: user.uid,
        }));
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Profile Load Error", description: "Could not load cafe profile data." });
    } finally {
      setIsLoading(false);
    }
  }, [user, userProfile, toast]);
  useEffect(() => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }
    if (!user || userProfile?.role !== 'cafe_manager') {
      toast({ variant: "destructive", title: "Access Denied", description: "You must be a cafe manager." });
      router.replace("/dashboard");
    } else {
      fetchCafeProfile();
    }
  }, [authLoading, user, userProfile, router, toast, fetchCafeProfile]);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith("socialLinks.")) {
      const field = name.split(".")[1] as keyof CafeProfileFormData["socialLinks"];
      setFormData((prev) => ({
        ...prev,
        socialLinks: { ...prev.socialLinks, [field]: value }
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: name === "capacity" ? parseInt(value, 10) || 0 : value }));
    }
  };
  const handleFacilityChange = (facility: string, checked: boolean) => {
    setFormData((prev) => {
      const newFacilities = checked
        ? [...(prev.facilities || []), facility]
        : (prev.facilities || []).filter((fac) => fac !== facility);
      return { ...prev, facilities: newFacilities };
    });
  };
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImageFiles(Array.from(e.target.files));
    }
  };
  const handleRemoveImageUrl = (urlToRemove: string) => {
    setFormData(prev => ({ ...prev, imageUrls: (prev.imageUrls || []).filter(url => url !== urlToRemove) }));
  };
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !user.uid) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You are not logged in." });
      return;
      }
    setIsSaving(true);
    const currentUserId = user.uid;
    try {
      let currentImageUrls = [...(formData.imageUrls || [])];
      if (imageFiles.length > 0) {
        const storage = getStorage();
        toast({ title: "Image Upload", description: `Uploading ${imageFiles.length} image(s)...`, duration: imageFiles.length * 2000 });
        for (const file of imageFiles) {
          const imageRef = ref(storage, `cafe_images/${currentUserId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`);
          await uploadBytes(imageRef, file);
          const downloadURL = await getDownloadURL(imageRef);
          currentImageUrls.push(downloadURL);
        }
      }
      setImageFiles([]);
      const dataToSave = {
        ...formData,
        imageUrls: currentImageUrls,
        managerId: currentUserId,
        updatedAt: serverTimestamp(),
      };
      
      const isNewCafe = !dataToSave.id;
      if (isNewCafe) {
          dataToSave.createdAt = serverTimestamp();
      }
      const docRefPath = dataToSave.id || doc(collection(db, "cafes")).id;
      const cafeDocRef = doc(db, "cafes", docRefPath);
      await setDoc(cafeDocRef, dataToSave, { merge: !isNewCafe });
      toast({ title: "Cafe Profile Saved", description: "Your cafe profile has been successfully updated." });
      router.push("/dashboard");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Save Failed", description: `Could not save cafe profile: ${error.message}`, duration: 10000 });
    } finally {
      setIsSaving(false);
    }
  };
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Loading Profile Setup...</p>
      </div>
    );
  }
   if (!user || userProfile?.role !== 'cafe_manager') {
      return null;
  }
          <CardHeader>
          <CardTitle className="text-2xl">Cafe Profile & Availability Setup</CardTitle>
          <CardDescription>Manage your cafe's details, preferred availability, and images.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            <section className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name"><CoffeeIcon className="inline h-4 w-4 mr-1 relative -top-0.5" />Cafe Name</Label>
                  <Input id="name" name="name" value={formData.name} onChange={handleChange} placeholder="e.g., The Cozy Corner Cafe" required disabled={isSaving}/>
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="personName">Your Name (Manager)</Label>
                  <Input id="personName" name="personName" value={formData.personName} onChange={handleChange} placeholder="e.g., Alex Smith" required disabled={isSaving}/>
                </div>
              </div>
               <div className="space-y-2">
                  <Label htmlFor="location"><MapPinIcon className="inline h-4 w-4 mr-1 relative -top-0.5" />Location / Address</Label>
                  <Input id="location" name="location" value={formData.location} onChange={handleChange} placeholder="e.g., 123 Main St, Anytown" required disabled={isSaving}/>
                </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" value={formData.description} onChange={handleChange} placeholder="Tell us about your cafe's vibe, specialties, etc." rows={3} disabled={isSaving}/>
              </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input id="contactEmail" name="contactEmail" type="email" value={formData.contactEmail} onChange={handleChange} placeholder="cafe@example.com" required disabled={isSaving}/>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact Phone (for WhatsApp)</Label>
                  <Input id="contactPhone" name="contactPhone" type="tel" value={formData.contactPhone} onChange={handleChange} placeholder="e.g. 1234567890 (no + or spaces)" required disabled={isSaving}/>
                </div>
              </div>
            </section>
            <section className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Capacity & Facilities</h3>
              <div className="space-y-2">
                <Label htmlFor="capacity"><UsersIcon className="inline h-4 w-4 mr-1 relative -top-0.5" />Total Capacity</Label>
                <Input id="capacity" name="capacity" type="number" value={formData.capacity} onChange={handleChange} placeholder="e.g., 50" disabled={isSaving}/>
              </div>
              <div className="space-y-2">
                <Label>Facilities (select all that apply)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                  {allFacilities.map((facility) => (
                    <div key={facility} className="flex items-center space-x-2">
                      <Checkbox
                        id={`facility-${facility.replace(/\s+/g, '-')}`}
                        checked={(formData.facilities || []).includes(facility)}
                        onCheckedChange={(checked) => handleFacilityChange(facility, !!checked)}
                        disabled={isSaving}
                      />
                      <Label htmlFor={`facility-${facility.replace(/\s+/g, '-')}`} className="font-normal text-sm">{facility}</Label>
                    </div>
                  ))}
                </div>
              </div>
               <div className="space-y-2">
                <Label htmlFor="ambienceType">Ambience Type</Label>
                <Input id="ambienceType" name="ambienceType" value={formData.ambienceType} onChange={handleChange} placeholder="e.g., Cozy, Modern, Rooftop, Outdoor Garden" disabled={isSaving}/>
              </div>
            </section>
            <section className="space-y-4 p-4 border rounded-md">
              <h3 className="text-lg font-semibold border-b pb-2">Availability & Preferences</h3>
              <div className="space-y-2">
                <Label htmlFor="availability"><CalendarDays className="inline h-4 w-4 mr-1 relative -top-0.5" />Preferred Days</Label>
                <Textarea
                  id="availability"
                  name="availability"
                  value={formData.availability}
                  onChange={handleChange}
                  placeholder="e.g., Weekends, Flexible weekdays PM, Specific dates: 2025-07-15, 2025-08-01 to 2025-08-10"
                  rows={2}
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground">Describe your general availability or specific date ranges.</p>
              </div>
               <div className="space-y-2">
                <Label htmlFor="preferredTimeSlots"><Clock className="inline h-4 w-4 mr-1 relative -top-0.5" />Preferred Time Slots (Text Description)</Label>
                 <Textarea
                    id="preferredTimeSlots"
                    name="preferredTimeSlots"
                    value={formData.preferredTimeSlots}
                    onChange={handleChange}
                    placeholder="e.g., Evenings 6 PM - 9 PM, Saturday afternoons, Flexible"
                    rows={2}
                    disabled={isSaving}
                  />
                  <p className="text-xs text-muted-foreground">Describe preferred time slots or typical operating hours for events.</p>
              </div>
            </section>
            <section className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2"><ImageIcon className="inline h-5 w-5 mr-1 relative -top-0.5" />Cafe Images</h3>
              <div className="space-y-2">
                <Label htmlFor="imageFiles">Upload Images (select one or more)</Label>
                <Input id="imageFiles" type="file" multiple onChange={handleImageFileChange} accept="image/*" disabled={isSaving}/>
                {imageFiles.length > 0 && <p className="text-xs text-muted-foreground">{imageFiles.length} file(s) selected for upload.</p>}
              </div>
              {(formData.imageUrls && formData.imageUrls.length > 0) && (
                <div className="mt-3 space-y-2 rounded-md border p-3 max-h-48 overflow-y-auto">
                  <Label>Current Image URLs:</Label>
                  {formData.imageUrls.map((url, index) => (
                    <div key={index} className="flex items-center justify-between text-sm p-1.5 bg-secondary rounded">
                       <img
                        src={url}
                        alt={`Cafe preview ${index + 1}`}
                        className="h-10 w-10 object-cover rounded-sm mr-2"
                        data-ai-hint="cafe food"
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/40x40.png'; }}
                      />
                      <a href={url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline flex-1 max-w-[calc(100%-5rem)]">{url}</a>
                       <Button type="button" onClick={() => handleRemoveImageUrl(url)} size="icon" variant="ghost" className="h-6 w-6" disabled={isSaving}>
                       <Button type="button" onClick={() => handleRemoveImageUrl(url)} size="icon" variant="ghost" className="h-6 w-6" disabled={isSaving} aria-label="Remove image">
                        <Trash2 className="h-4 w-4 text-destructive"/>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
                  <div className="space-y-2">
                <Label htmlFor="imageHint">Image Placeholder Hint</Label>
                <Input id="imageHint" name="imageHint" value={formData.imageHint} onChange={handleChange} placeholder="e.g., cozy cafe books" disabled={isSaving}/>
                <p className="text-xs text-muted-foreground">Keywords for placeholder images (max 2 words).</p>
              </div>
            </section>
            <section className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Additional Details</h3>
              <div className="space-y-2">
                <Label htmlFor="houseRules">House Rules</Label>
                <Textarea id="houseRules" name="houseRules" value={formData.houseRules} onChange={handleChange} placeholder="e.g., No outside food or drinks, pets allowed on patio." rows={3} disabled={isSaving}/>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="socialLinks.instagram">Instagram</Label>
                  <Input id="socialLinks.instagram" name="socialLinks.instagram" value={formData.socialLinks.instagram} onChange={handleChange} placeholder="https://instagram.com/yourcafe" disabled={isSaving}/>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="socialLinks.facebook">Facebook</Label>
                  <Input id="socialLinks.facebook" name="socialLinks.facebook" value={formData.socialLinks.facebook} onChange={handleChange} placeholder="https://facebook.com/yourcafe" disabled={isSaving}/>
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="socialLinks.website">Website</Label>
                  <Input id="socialLinks.website" name="socialLinks.website" value={formData.socialLinks.website} onChange={handleChange} placeholder="https://yourcafe.com" disabled={isSaving}/>
                   </div>
              </div>
            </section>
            <Button type="submit" disabled={isSaving} className="w-full md:w-auto text-lg py-3 px-6">
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              {isSaving ? "Saving Profile..." : (formData.id ? "Update Cafe Profile" : "Create Cafe Profile")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';
import React, { useState, useEffect, type FormEvent, useCallback } from "react";
import { doc, setDoc, getDoc, serverTimestamp, type FieldValue } from "firebase/firestore";
import { db, storage as firebaseStorage } from '@/lib/firebase/config';
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, PlusCircle, Trash2, Image as ImageIcon, CalendarDays, Clock, InfoIcon, User as UserIcon, Users as UsersIcon, Phone as PhoneIcon, Languages, Link as LinkIcon, MicIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { Switch } from "@/components/ui/switch";
interface OrganizerProfileFormData {
  id?: string;
  fullName: string;
  organizationName?: string;
  email: string;
  phone: string;
  city: string;
  imageUrls: string[];
  imageHint: string;
  organizerType: string;
  bio: string;
  categories: string[];
  experienceDescription: string;
  languagesSpoken: string[];
  availability: string;
  preferredTimeSlots: string;
  isFlexible: boolean;
  flexibleTimingNotes: string;
  socialLinks: {
    instagram: string;
    facebook: string;
    website: string;
    youtube: string;
  };
  specialRequirements: string;
  createdAt?: FieldValue;
  updatedAt?: FieldValue;
}
const initialFormData: OrganizerProfileFormData = {
  fullName: "",
  organizationName: "",
  email: "",
  phone: "",
  city: "",
  imageUrls: [],
  imageHint: "event professional band",
  organizerType: "",
  bio: "",
  categories: [],
  experienceDescription: "",
  languagesSpoken: [],
  availability: "",
  preferredTimeSlots: "",
  isFlexible: false,
  flexibleTimingNotes: "",
  socialLinks: { instagram: "", facebook: "", website: "", youtube: "" },
  specialRequirements: "",
};
const eventCategories = [
    "Art Workshops (Painting, Resin Art, etc.)",
    "Music Performances (Live Band, DJ)",
    "Stand-Up Comedy",
    "Yoga/Wellness Classes",
    "Baking/Cooking Workshops",
    "Poetry Reading/Spoken Word",
    "Book Club/Discussion Group",
    "Tech Meetup/Coding Workshop",
    "Craft Fair/Market Stall",
];
export default function OrganizerProfileSetupPage() {
    const router = useRouter();
    const { user, userProfile, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [formData, setFormData] = useState<OrganizerProfileFormData>(initialFormData);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [newLanguage, setNewLanguage] = useState("");
    const [isNewProfile, setIsNewProfile] = useState(false);
  const fetchOrganizerProfile = useCallback(async () => {
        if (!user || userProfile?.role !== 'organizer') {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const organizerDocRef = doc(db, "organizers", user.uid);
            const docSnap = await getDoc(organizerDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setIsNewProfile(false);
                setFormData({
                    ...initialFormData,
                    ...data,
                    id: docSnap.id,
                    fullName: data.fullName || userProfile.name || user.displayName || "",
                    email: data.email || user.email || "",
                    phone: data.phone || userProfile.phone || "",
                });
            } else {
                setIsNewProfile(true);
                setFormData(prev => ({
                    ...prev,
                    email: user.email || "",
                    fullName: userProfile?.name || user.displayName || "",
                    phone: userProfile?.phone || "",
                }));
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Profile Load Error", description: "Could not load your organizer profile data." });
        } finally {
            setIsLoading(false);
        }
    }, [user, userProfile, toast]);
    useEffect(() => {
        if (authLoading) {
            setIsLoading(true);
            return;
        }
      if (!user || userProfile?.role !== 'organizer') {
            toast({ variant: "destructive", title: "Access Denied", description: "You must be an organizer to access this page." });
            router.replace("/dashboard");
        } else {
            fetchOrganizerProfile();
        }
    }, [authLoading, user, userProfile, router, toast, fetchOrganizerProfile]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name.startsWith("socialLinks.")) {
            const field = name.split(".")[1] as keyof OrganizerProfileFormData["socialLinks"];
            setFormData(prev => ({ ...prev, socialLinks: { ...prev.socialLinks, [field]: value }}));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };
    
    const handleSelectChange = (name: keyof OrganizerProfileFormData, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    const handleCategoryChange = (category: string, checked: boolean) => {
        setFormData(prev => {
            const newCategories = checked
                ? [...prev.categories, category]
                : prev.categories.filter(cat => cat !== category);
            return { ...prev, categories: newCategories };
        });
    };
    const handleLanguageAdd = () => {
        if (newLanguage.trim() && !formData.languagesSpoken.includes(newLanguage.trim())) {
            setFormData(prev => ({
                ...prev,
                languagesSpoken: [...prev.languagesSpoken, newLanguage.trim()]
            }));
            setNewLanguage("");
        }
    };
  const handleLanguageRemove = (langToRemove: string) => {
        setFormData(prev => ({
            ...prev,
            languagesSpoken: prev.languagesSpoken.filter(lang => lang !== langToRemove)
        }));
    };
    const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setImageFiles(Array.from(e.target.files));
        }
    };
    const handleRemoveImageUrl = (urlToRemove: string) => {
        setFormData(prev => ({...prev, imageUrls: prev.imageUrls.filter(url => url !== urlToRemove)}));
    };
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!user) {
            toast({ variant: "destructive", title: "Authentication Error", description: "You are not logged in." });
            return;
        }
        setIsSaving(true);
        toast({ title: "Profile Update Initiated", description: "Saving your organizer profile..." });
        try {
            let uploadedImageUrls = [...formData.imageUrls];
            if (imageFiles.length > 0) {
                for (const file of imageFiles) {
                    const imageRef = storageRef(firebaseStorage, `organizer_images/${user.uid}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`);
                    await uploadBytes(imageRef, file);
                    const downloadURL = await getDownloadURL(imageRef);
                          );
    }
    if (!user || userProfile?.role !== 'organizer') {
        return null;
    }
    return (
        <div className="container mx-auto p-4 md:p-8">
            <Button variant="outline" onClick={() => router.back()} className="mb-6">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
            <Card className="max-w-3xl mx-auto shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl">Organizer Profile Setup</CardTitle>
                    <CardDescription>Showcase your brand, events, and availability to connect with cafés.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Core Information Section */}
                        <section className="space-y-4 p-4 border rounded-md">
                            <h3 className="text-lg font-semibold border-b pb-2">Core Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="fullName"><UserIcon className="inline h-4 w-4 mr-1 relative -top-0.5" />Full Name / Brand Name</Label>
                                    <Input id="fullName" name="fullName" value={formData.fullName} onChange={handleChange} placeholder="e.g., Your Name or Band Name" required disabled={isSaving} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="organizationName"><UsersIcon className="inline h-4 w-4 mr-1 relative -top-0.5" />Organization Name (Optional)</Label>
                                    <Input id="organizationName" name="organizationName" value={formData.organizationName} onChange={handleChange} placeholder="e.g., The Artful Nomad Events" disabled={isSaving} />
                                                              </div>
                        </section>
                        {/* Professional Details Section */}
                        <section className="space-y-4 p-4 border rounded-md">
                            <h3 className="text-lg font-semibold border-b pb-2">Professional Details</h3>
                            <div className="space-y-2">
                                <Label htmlFor="organizerType">Organizer Type</Label>
                                <Select name="organizerType" value={formData.organizerType} onValueChange={(value) => handleSelectChange("organizerType", value)} disabled={isSaving}>
                                    <SelectTrigger id="organizerType"><SelectValue placeholder="Select Your Organizer Type" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Workshop Facilitator">Workshop Facilitator</SelectItem>
                                        <SelectItem value="Live Band">Live Band</SelectItem>
                                        <SelectItem value="DJ">DJ</SelectItem>
                                        <SelectItem value="Stand-Up Comedian">Stand-Up Comedian</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="categories">Event Specialties (select all that apply)</Label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 pt-2 max-h-48 overflow-y-auto border p-3 rounded-md">
                                    {eventCategories.map(cat => (
                                        <div key={cat} className="flex items-center space-x-2">
                                            <Checkbox id={`cat-${cat.replace(/\s+/g, '-').toLowerCase()}`} checked={formData.categories.includes(cat)} onCheckedChange={(checked) => handleCategoryChange(cat, !!checked)} disabled={isSaving} />
                                            <Label htmlFor={`cat-${cat.replace(/\s+/g, '-').toLowerCase()}`} className="font-normal text-sm leading-tight">{cat}</Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="experienceDescription">Experience (Short Description)</Label>
                                <Textarea id="experienceDescription" name="experienceDescription" value={formData.experienceDescription} onChange={handleChange} placeholder="e.g., 5+ years hosting workshops, performed at various local venues..." rows={3} disabled={isSaving} />
                                                                   </Button>
                                 </div>
                                {formData.languagesSpoken.length > 0 && (
                                    <div className="mt-2 space-y-1 rounded-md border p-2 text-sm max-h-28 overflow-y-auto">
                                        {formData.languagesSpoken.map((lang, index) => (
                                            <div key={index} className="flex items-center justify-between bg-secondary p-1 rounded">
                                                <span>{lang}</span>
                                                <Button type="button" onClick={() => handleLanguageRemove(lang)} size="icon" variant="ghost" className="h-5 w-5" disabled={isSaving}>
                                                <Button type="button" onClick={() => handleLanguageRemove(lang)} size="icon" variant="ghost" className="h-5 w-5" disabled={isSaving} aria-label="Remove language">
                                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>
                         {/* Availability Section */}
                        <section className="space-y-4 p-4 border rounded-md">
                            <h3 className="text-lg font-semibold border-b pb-2">Availability</h3>
                             <div className="flex items-center space-x-2 pt-2">
                                <Switch id="isFlexible" checked={formData.isFlexible} onCheckedChange={(checked) => setFormData(prev => ({...prev, isFlexible: checked}))} disabled={isSaving} />
                                <Label htmlFor="isFlexible" className="text-base font-medium">I'm Flexible with Event Timing</Label>
                            </div>
                            {formData.isFlexible ? (
                                <>
                                 <div className="p-3 mt-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 flex items-start">
                                    <InfoIcon className="h-4 w-4 mt-0.5 mr-2 text-gray-500" />
                                    <span>By enabling this, you are telling cafe managers you're open to discussing dates and times.</span>
                                </div>
                                <div className="space-y-2 pt-2">
                                    <Label htmlFor="flexibleTimingNotes">Any General Availability Notes (Optional)</Label>
                                    <Textarea id="flexibleTimingNotes" name="flexibleTimingNotes" value={formData.flexibleTimingNotes} onChange={handleChange} placeholder="e.g., Generally available on weekends, prefer evening slots" rows={2} disabled={isSaving} />
                                </div>
                                </>
                            ) : (
                                <>
                                <div className="space-y-2">
                                    <Label htmlFor="availability"><CalendarDays className="inline h-4 w-4 mr-1 relative -top-0.5" />Preferred Days</Label>
                                                      {imageFiles.length > 0 && <p className="text-xs text-muted-foreground">{imageFiles.length} file(s) selected for upload.</p>}
                            </div>
                            {formData.imageUrls.length > 0 && (
                                <div className="mt-3 space-y-2 rounded-md border p-3 max-h-48 overflow-y-auto">
                                    <Label>Current Images:</Label>
                                    {formData.imageUrls.map((url, index) => (
                                        <div key={index} className="flex items-center justify-between text-sm p-1.5 bg-secondary rounded">
                                            <img src={url} alt={`Preview ${index}`} className="h-10 w-10 object-cover rounded-sm mr-2" data-ai-hint="event photo" />
                                            <a href={url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline flex-1">{url}</a>
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
                                <Input id="imageHint" name="imageHint" value={formData.imageHint} onChange={handleChange} placeholder="e.g., live music band stage" disabled={isSaving}/>
                                <p className="text-xs text-muted-foreground">Keywords for placeholder images (max 2 words).</p>
                            </div>
                        </section>
                        {/* Social Links & Requirements Section */}
                         <section className="space-y-4 p-4 border rounded-md">
                            <h3 className="text-lg font-semibold border-b pb-2"><LinkIcon className="inline h-5 w-5 mr-1 relative -top-0.5" />Social Media & Links</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                <div className="space-y-2"><Label htmlFor="socialLinks.instagram">Instagram</Label><Input id="socialLinks.instagram" name="socialLinks.instagram" value={formData.socialLinks.instagram} onChange={handleChange} placeholder="https://instagram.com/yourprofile" disabled={isSaving} /></div>
                                <div className="space-y-2"><Label htmlFor="socialLinks.facebook">Facebook</Label><Input id="socialLinks.facebook" name="socialLinks.facebook" value={formData.socialLinks.facebook} onChange={handleChange} placeholder="https://facebook.com/yourpage" disabled={isSaving} /></div>
                                <div className="space-y-2"><Label htmlFor="socialLinks.website">Website/Portfolio</Label><Input id="socialLinks.website" name="socialLinks.website" value={formData.socialLinks.website} onChange={handleChange} placeholder="https://yourwebsite.com" disabled={isSaving} /></div>
                                <div className="space-y-2"><Label htmlFor="socialLinks.youtube">YouTube Channel</Label><Input id="socialLinks.youtube" name="socialLinks.youtube" value={formData.socialLinks.youtube} onChange={handleChange} placeholder="https://youtube.com/yourchannel" disabled={isSaving} /></div>
                              </div>
                        </section>
                        <section className="space-y-4 p-4 border rounded-md">
                            <h3 className="text-lg font-semibold border-b pb-2">More About You</h3>
                            <div className="space-y-2">
                                <Label htmlFor="bio"><InfoIcon className="inline h-4 w-4 mr-1 relative -top-0.5" />About Me / Bio (Short intro or mission)</Label>
                                <Textarea id="bio" name="bio" value={formData.bio} onChange={handleChange} placeholder="Describe your work, style, past successes, and what you offer." rows={4} disabled={isSaving}/>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="specialRequirements"><MicIcon className="inline h-4 w-4 mr-1 relative -top-0.5" />Technical Requirements (e.g., mic, projector, stage size)</Label>
                                <Textarea id="specialRequirements" name="specialRequirements" value={formData.specialRequirements} onChange={handleChange} placeholder="e.g., Min. stage size, specific audio setup, quiet room for workshops." rows={3} disabled={isSaving}/>
                            </div>
                        </section>
                        <Button type="submit" disabled={isSaving} className="w-full md:w-auto text-lg py-3 px-6">
                            {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                            {isSaving ? 'Saving Profile...' : (isNewProfile ? 'Create Profile' : 'Update Profile')}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

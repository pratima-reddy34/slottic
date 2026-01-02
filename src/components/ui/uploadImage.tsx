import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from '@/lib/firebase/config'; // Update path based on your project structure

/**
 * Uploads a single cafe image to Firebase Storage and returns its download URL.
 * @param file - The image file to upload
 * @returns The download URL as a string
 */
export const uploadCafeImage = async (file: File): Promise<string> => {
  try {
    const storage = getStorage(app);
    const fileRef = ref(storage, `cafe-images/${Date.now()}-${file.name}`);
    await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(fileRef);
    return downloadURL;
  } catch (error) {
    console.error('Image upload failed:', error);
    throw new Error('Failed to upload image');
  }
};

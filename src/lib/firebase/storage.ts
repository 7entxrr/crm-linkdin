import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getClientStorage, getClientAuth } from "@/lib/firebase/client";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function validateImage(file: File): string | null {
  if (!ALLOWED.includes(file.type)) {
    return "Please upload a JPG, PNG, WEBP, or GIF image";
  }
  if (file.size > MAX_BYTES) {
    return "Image must be under 5MB";
  }
  return null;
}

/**
 * Uploads an avatar image to Firebase Storage under the current user's folder
 * (satisfies storage.rules: avatars/{uid}/...) and returns a download URL.
 */
export async function uploadAvatar(file: File): Promise<string> {
  const uid = getClientAuth().currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");

  const error = validateImage(file);
  if (error) throw new Error(error);

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `avatars/${uid}/${Date.now()}.${ext}`;
  const storageRef = ref(getClientStorage(), path);

  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

// Returns a File ready to append to FormData, from camera or gallery.
export async function capturePhoto(source: 'camera' | 'gallery' = 'camera'): Promise<File> {
  if (Capacitor.isNativePlatform()) {
    const photo = await Camera.getPhoto({
      quality: 80,
      resultType: CameraResultType.DataUrl,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      correctOrientation: true,
    });
    const res = await fetch(photo.dataUrl!);
    const blob = await res.blob();
    return new File([blob], `photo.${photo.format || 'jpg'}`, { type: blob.type || 'image/jpeg' });
  }
  // Web fallback: hidden file input
  return new Promise<File>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') input.capture = 'environment';
    input.onchange = () => {
      const f = input.files?.[0];
      f ? resolve(f) : reject(new Error('no file'));
    };
    input.click();
  });
}

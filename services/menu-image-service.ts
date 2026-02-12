
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export const MenuImageService = {
  BUCKET: 'menu-items',

  async uploadMenuImage(file: File, restaurantId: number): Promise<string> {
    try {
      // Convert to WebP to match bucket restrictions and Flutter app behavior
      const webpBlob = await this.convertImageToWebP(file);
      
      const fileName = `${uuidv4()}.webp`;
      const filePath = `${restaurantId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(this.BUCKET)
        .upload(filePath, webpBlob, {
          contentType: 'image/webp',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from(this.BUCKET)
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error in uploadMenuImage:', error);
      throw error;
    }
  },

  convertImageToWebP(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('WebP conversion failed'));
            }
          },
          'image/webp',
          0.8 // Quality 0.8
        );
      };
      img.onerror = (error) => reject(error);
      img.src = URL.createObjectURL(file);
    });
  }
};

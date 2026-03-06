import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export const MenuImageService = {
  BUCKET: 'menu-items',

  async uploadMenuImage(file: File, restaurantId: number): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment variables.');
    }

    try {
      // Extract original connection extension or default to .jpg
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `${restaurantId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(this.BUCKET)
        .upload(filePath, file, {
          contentType: file.type,
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
  }
};

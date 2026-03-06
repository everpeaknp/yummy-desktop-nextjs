import { getBaseUrl } from '@/lib/utils';

export const MenuImageService = {
  BUCKET: 'menu-items', // Kept for backend reference if needed

  async uploadMenuImage(file: File, restaurantId: number): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      // The backend uses restaurant_id from the token, but we can pass it if needed
      formData.append('restaurant_id', restaurantId.toString());

      // Get the correct base URL for the API (handles local vs production)
      const baseUrl = getBaseUrl();
      const uploadUrl = `${baseUrl}/api/menu/upload`;

      // Get the auth token from localStorage
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

      const response = await import('axios').then(async (axios) => {
        return axios.default.post(uploadUrl, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': token ? `Bearer ${token}` : '',
          },
        });
      });

      if (response.data && response.data.file_url) {
         // The backend returns the newly uploaded Cloudinary URL
         return response.data.file_url;
      }

      throw new Error("Invalid response from server during upload");
      
    } catch (error) {
      console.error('Error in uploadMenuImage:', error);
      throw error;
    }
  }
};

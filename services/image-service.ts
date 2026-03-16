import apiClient from '@/lib/api-client';
import { MenuApis, RestaurantApis, AuthApis } from '@/lib/api/endpoints';

export const ImageService = {
  /**
   * Upload logo or cover photo for a restaurant
   */
  async uploadRestaurantImage(file: File, type: 'logo' | 'cover', restaurantId?: number): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      if (restaurantId) {
        formData.append('restaurant_id', restaurantId.toString());
      }

      const response = await apiClient.post(RestaurantApis.upload, formData);

      if (response.data.status === 'success') {
        return response.data.data.file_url;
      } else {
        throw new Error(response.data.message || 'Failed to upload restaurant image');
      }
    } catch (error) {
      console.error(`Error in uploadRestaurantImage (${type}):`, error);
      throw error;
    }
  },

  /**
   * Upload image for a menu item
   */
  async uploadMenuImage(file: File, restaurantId: number): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('restaurant_id', restaurantId.toString());

      const response = await apiClient.post(MenuApis.upload, formData);

      if (response.data.status === 'success') {
        return response.data.data.file_url;
      } else {
        throw new Error(response.data.message || 'Failed to upload menu image');
      }
    } catch (error) {
      console.error('Error in uploadMenuImage:', error);
      throw error;
    }
  },

  /**
   * Upload user profile picture
   */
  async uploadProfilePicture(file: File): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post(AuthApis.uploadProfilePicture, formData);

      if (response.data.status === 'success') {
        return response.data.data.file_url;
      } else {
        throw new Error(response.data.message || 'Failed to upload profile picture');
      }
    } catch (error) {
      console.error('Error in uploadProfilePicture:', error);
      throw error;
    }
  }
};

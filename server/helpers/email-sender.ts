import axios from 'axios';

const MAILMODO_API_KEY = process.env.MAILMODO_API_KEY;
const MAILMODO_BASE_URL = process.env.MAILMODO_BASE_URL;

type EmailData = {
  to: string;
  campaignData: {
    [key: string]: string | string[];
  };
  templateData: {
    [key: string]: string | string[];
  };
  campaignId: string;
};

export const sendEmail = async ({ to, campaignData, campaignId,templateData }: EmailData) => {
  try {
    const response = await axios.post(
      MAILMODO_BASE_URL+`/${campaignId}`,
      {
        email: to,
        data: templateData,
        campaign_data: campaignData,
      },
      {
        headers: { 'Content-Type': 'application/json', mmApiKey: MAILMODO_API_KEY, Accept: 'application/json' },

      }
    );

    if (response.status !== 200) {
      throw new Error(`Failed to send email: ${response.statusText}`);
    }

    return response.data;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};
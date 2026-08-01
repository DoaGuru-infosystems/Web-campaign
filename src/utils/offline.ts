import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CALLS } from './api';

const KEYS = {
  CAMPAIGNS: 'OFFLINE_CAMPAIGNS',
  CAMPAIGN_SCHEMAS: 'OFFLINE_CAMPAIGN_SCHEMAS', // object keyed by campaignId
  TEST_TEMPLATES: 'OFFLINE_TEST_TEMPLATES', // object keyed by templateId
  QUEUE_REGISTRATIONS: 'OFFLINE_QUEUE_REGISTRATIONS', // array of offline registrations
  QUEUE_TESTS: 'OFFLINE_QUEUE_TESTS', // array of offline tests
};

export interface OfflineCampaign {
  id: number;
  title: string;
  category: string;
  status: string;
  description?: string;
  total_registrations?: number;
  start_date?: string;
  banner_url?: string;
  test_template_id?: number | null;
}

export const OfflineManager = {
  // Check if a campaign is cached offline
  isCampaignOffline: async (campaignId: number): Promise<boolean> => {
    const listJson = await AsyncStorage.getItem(KEYS.CAMPAIGNS);
    if (!listJson) return false;
    const list: OfflineCampaign[] = JSON.parse(listJson);
    return list.some(c => c.id === campaignId);
  },

  // Save campaign offline
  saveCampaignOffline: async (camp: OfflineCampaign, serverUrl: string, token?: string): Promise<void> => {
    try {
      // 1. Fetch campaign fields schema (public API)
      const data = await API_CALLS.get(`/campaigns/public/${camp.id}`, serverUrl);
      const fields = data.fields || [];

      // 2. Fetch test template if assigned
      let template = null;
      if (camp.test_template_id) {
        try {
          const res = await API_CALLS.get('/test-templates', serverUrl, token);
          const templates = res.templates || [];
          template = templates.find((t: any) => t.id === camp.test_template_id) || null;
        } catch (err) {
          console.log('Failed to fetch template during offline save, continuing with null:', err);
        }
      }

      // 3. Save to campaigns list
      const listJson = await AsyncStorage.getItem(KEYS.CAMPAIGNS);
      let list: OfflineCampaign[] = listJson ? JSON.parse(listJson) : [];
      if (!list.some(c => c.id === camp.id)) {
        list.push(camp);
        await AsyncStorage.setItem(KEYS.CAMPAIGNS, JSON.stringify(list));
      }

      // 4. Save fields schema
      const schemasJson = await AsyncStorage.getItem(KEYS.CAMPAIGN_SCHEMAS);
      const schemas = schemasJson ? JSON.parse(schemasJson) : {};
      schemas[camp.id] = fields;
      await AsyncStorage.setItem(KEYS.CAMPAIGN_SCHEMAS, JSON.stringify(schemas));

      // 5. Save test template
      if (camp.test_template_id && template) {
        const templatesJson = await AsyncStorage.getItem(KEYS.TEST_TEMPLATES);
        const templates = templatesJson ? JSON.parse(templatesJson) : {};
        templates[camp.test_template_id] = template;
        await AsyncStorage.setItem(KEYS.TEST_TEMPLATES, JSON.stringify(templates));
      }
    } catch (e: any) {
      throw new Error(`Failed to save campaign offline: ${e.message}`);
    }
  },

  // Remove campaign offline cache
  removeCampaignOffline: async (campaignId: number): Promise<void> => {
    // 1. Remove from campaigns list
    const listJson = await AsyncStorage.getItem(KEYS.CAMPAIGNS);
    if (listJson) {
      const list: OfflineCampaign[] = JSON.parse(listJson);
      const updated = list.filter(c => c.id !== campaignId);
      await AsyncStorage.setItem(KEYS.CAMPAIGNS, JSON.stringify(updated));
    }

    // 2. Remove fields schema
    const schemasJson = await AsyncStorage.getItem(KEYS.CAMPAIGN_SCHEMAS);
    if (schemasJson) {
      const schemas = JSON.parse(schemasJson);
      delete schemas[campaignId];
      await AsyncStorage.setItem(KEYS.CAMPAIGN_SCHEMAS, JSON.stringify(schemas));
    }
  },

  // Get all cached campaigns
  getCachedCampaigns: async (): Promise<OfflineCampaign[]> => {
    const listJson = await AsyncStorage.getItem(KEYS.CAMPAIGNS);
    return listJson ? JSON.parse(listJson) : [];
  },

  // Get cached campaign fields
  getCachedCampaignFields: async (campaignId: number): Promise<any[]> => {
    const schemasJson = await AsyncStorage.getItem(KEYS.CAMPAIGN_SCHEMAS);
    if (!schemasJson) return [];
    const schemas = JSON.parse(schemasJson);
    return schemas[campaignId] || [];
  },

  // Get cached template
  getCachedTemplate: async (templateId: number): Promise<any | null> => {
    const templatesJson = await AsyncStorage.getItem(KEYS.TEST_TEMPLATES);
    if (!templatesJson) return null;
    const templates = JSON.parse(templatesJson);
    return templates[templateId] || null;
  },

  // Queue registration locally
  queueRegistration: async (campaignId: number, submittedData: any): Promise<string> => {
    const localId = `OFFLINE-REG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const regQueueJson = await AsyncStorage.getItem(KEYS.QUEUE_REGISTRATIONS);
    const queue = regQueueJson ? JSON.parse(regQueueJson) : [];
    
    queue.push({
      id: Math.floor(Math.random() * 1000000), // temp DB id for display rendering
      registration_id: localId,
      campaign_id: campaignId,
      submitted_data: submittedData,
      status: 'PendingSync',
      created_at: new Date().toISOString()
    });

    await AsyncStorage.setItem(KEYS.QUEUE_REGISTRATIONS, JSON.stringify(queue));
    return localId;
  },

  // Get all unsynced registrations
  getOfflineRegistrations: async (): Promise<any[]> => {
    const json = await AsyncStorage.getItem(KEYS.QUEUE_REGISTRATIONS);
    return json ? JSON.parse(json) : [];
  },

  // Queue test details locally
  queueTest: async (
    registrationId: string,
    vitalsData: any,
    testData: any,
    referToHospital = 'No',
    travellingBy = 'None'
  ): Promise<void> => {
    const testsQueueJson = await AsyncStorage.getItem(KEYS.QUEUE_TESTS);
    const queue: any[] = testsQueueJson ? JSON.parse(testsQueueJson) : [];
    
    const index = queue.findIndex(t => t.registrationId === registrationId);
    
    const testRecord = {
      registrationId,
      vitals_data: vitalsData,
      test_data: testData,
      refer_to_hospital: referToHospital,
      travelling_by: travellingBy,
      status: 'PendingSync'
    };

    if (index > -1) {
      queue[index] = {
        ...queue[index],
        ...testRecord,
        vitals_data: {
          ...(queue[index].vitals_data || {}),
          ...(vitalsData || {})
        },
        test_data: {
          ...(queue[index].test_data || {}),
          ...(testData || {})
        }
      };
    } else {
      queue.push(testRecord);
    }

    await AsyncStorage.setItem(KEYS.QUEUE_TESTS, JSON.stringify(queue));
  },

  // Get all unsynced tests
  getOfflineTests: async (): Promise<any[]> => {
    const json = await AsyncStorage.getItem(KEYS.QUEUE_TESTS);
    return json ? JSON.parse(json) : [];
  },

  // Helper to upload offline file/images
  uploadOfflineFile: async (fileObj: any, serverUrl: string, token?: string): Promise<any> => {
    if (!fileObj || typeof fileObj !== 'object' || !fileObj.localUri) {
      return fileObj;
    }
    try {
      console.log(`[Offline Sync] Uploading cached file: ${fileObj.localUri}`);
      const res = await API_CALLS.upload(fileObj.localUri, fileObj.filename || 'offline_file.jpg', fileObj.mimetype || 'image/jpeg', serverUrl, token);
      return res;
    } catch (err) {
      console.error('[Offline Sync] Failed to upload offline file:', err);
      throw err;
    }
  },

  // Synchronize all data
  syncOfflineData: async (serverUrl: string, token?: string, onProgress?: (msg: string) => void): Promise<{ success: boolean; syncedCount: number; errors: string[] }> => {
    const results = { success: true, syncedCount: 0, errors: [] as string[] };
    
    const regQueueJson = await AsyncStorage.getItem(KEYS.QUEUE_REGISTRATIONS);
    const testsQueueJson = await AsyncStorage.getItem(KEYS.QUEUE_TESTS);
    
    let registrations: any[] = regQueueJson ? JSON.parse(regQueueJson) : [];
    let tests: any[] = testsQueueJson ? JSON.parse(testsQueueJson) : [];

    if (registrations.length === 0 && tests.length === 0) {
      onProgress?.('No offline data to sync.');
      return results;
    }

    const idMap: Record<string, string> = {};

    // 1. Process registrations
    const remainingRegs: any[] = [];
    for (let i = 0; i < registrations.length; i++) {
      const reg = registrations[i];
      onProgress?.(`Syncing registration ${i + 1}/${registrations.length}...`);
      
      try {
        const submittedData = { ...reg.submitted_data };

        // Upload any offline files in the submitted_data fields
        for (const [key, val] of Object.entries(submittedData)) {
          if (val && typeof val === 'object') {
            if ((val as any).isOfflineFile) {
              const uploaded = await OfflineManager.uploadOfflineFile(val, serverUrl, token);
              submittedData[key] = uploaded;
            } else if (Array.isArray(val)) {
              const uploadedList = [];
              for (const fileItem of val) {
                if (fileItem && fileItem.isOfflineFile) {
                  const uploaded = await OfflineManager.uploadOfflineFile(fileItem, serverUrl, token);
                  uploadedList.push(uploaded);
                } else {
                  uploadedList.push(fileItem);
                }
              }
              submittedData[key] = uploadedList;
            }
          }
        }

        const res = await API_CALLS.post('/registrations', {
          campaign_id: reg.campaign_id,
          submitted_data: submittedData,
        }, serverUrl, token);

        if (res.registration_id) {
          idMap[reg.registration_id] = res.registration_id;
          results.syncedCount++;
        }
      } catch (err: any) {
        console.error(`Syncing registration failed for ${reg.registration_id}:`, err);
        results.errors.push(`Registration: ${err.message || 'Unknown error'}`);
        remainingRegs.push(reg);
      }
    }

    await AsyncStorage.setItem(KEYS.QUEUE_REGISTRATIONS, JSON.stringify(remainingRegs));

    // 2. Process tests
    const remainingTests: any[] = [];
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      onProgress?.(`Syncing patient test ${i + 1}/${tests.length}...`);

      let targetRegId = test.registrationId;
      if (idMap[targetRegId]) {
        targetRegId = idMap[targetRegId];
      } else if (targetRegId.startsWith('OFFLINE-')) {
        remainingTests.push(test);
        continue;
      }

      try {
        const payload = {
          vitals_data: test.vitals_data,
          test_data: test.test_data,
          refer_to_hospital: test.refer_to_hospital,
          travelling_by: test.travelling_by
        };

        await API_CALLS.post(`/registrations/${targetRegId}/test`, payload, serverUrl, token);
      } catch (err: any) {
        console.error(`Syncing test failed for ${targetRegId}:`, err);
        results.errors.push(`Test: ${err.message || 'Unknown error'}`);
        remainingTests.push(test);
      }
    }

    await AsyncStorage.setItem(KEYS.QUEUE_TESTS, JSON.stringify(remainingTests));

    if (results.errors.length > 0) {
      results.success = false;
    }

    return results;
  }
};

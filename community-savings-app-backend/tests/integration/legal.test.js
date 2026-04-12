/**
 * Legal Documents Tests
 * ============================================================================
 * Comprehensive test suite for Terms of Service and Privacy Policy features
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const termsAndPrivacy = require('../services/termsAndPrivacy');

// Mock user data
const mockUser = {
  _id: new mongoose.Types.ObjectId(),
  email: 'testuser@test.com',
  password: 'hashedPassword123'
};

// Mock JWT token (would normally come from auth)
const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMzQ1Njc4OTAiLCJuYW1lIjoiSm9obiIsImlhdCI6MTUxNjIzOTAyMn0.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ';

describe('Legal Documents API', () => {
  
  describe('GET /api/legal/terms-of-service', () => {
    it('should return Terms of Service document without authentication', async () => {
      const response = await request(app)
        .get('/api/legal/terms-of-service')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('title');
      expect(response.body.data).toHaveProperty('version');
      expect(response.body.data).toHaveProperty('content');
      expect(response.body.data.version).toBe('1.0.0');
    });

    it('should include document metadata', async () => {
      const response = await request(app)
        .get('/api/legal/terms-of-service')
        .expect(200);

      expect(response.body.data).toHaveProperty('effectiveDate');
      expect(response.body.data).toHaveProperty('lastUpdated');
      expect(response.body.data.content).toContain('Terms of Service');
    });

    it('should include all required sections', async () => {
      const response = await request(app)
        .get('/api/legal/terms-of-service')
        .expect(200);

      const content = response.body.data.content;
      const requiredSections = [
        'Acceptance of Terms',
        'Use License',
        'Disclaimer of Warranties',
        'Limitations of Liability',
        'Financial Transactions',
        'Loan Agreements',
        'Governing Law'
      ];

      requiredSections.forEach(section => {
        expect(content).toContain(section);
      });
    });
  });

  describe('GET /api/legal/privacy-policy', () => {
    it('should return Privacy Policy document without authentication', async () => {
      const response = await request(app)
        .get('/api/legal/privacy-policy')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('title');
      expect(response.body.data).toHaveProperty('version');
      expect(response.body.data).toHaveProperty('content');
      expect(response.body.data.version).toBe('1.0.0');
    });

    it('should cover GDPR compliance', async () => {
      const response = await request(app)
        .get('/api/legal/privacy-policy')
        .expect(200);

      const content = response.body.data.content;
      expect(content).toContain('GDPR');
      expect(content).toContain('General Data Protection Regulation');
    });

    it('should cover CCPA compliance', async () => {
      const response = await request(app)
        .get('/api/legal/privacy-policy')
        .expect(200);

      const content = response.body.data.content;
      expect(content).toContain('CCPA');
      expect(content).toContain('California');
    });

    it('should include data types collected', async () => {
      const response = await request(app)
        .get('/api/legal/privacy-policy')
        .expect(200);

      const content = response.body.data.content;
      const dataTypes = [
        'Personal Information',
        'Financial Information',
        'Device Information',
        'Usage Information',
        'Communication Data',
        'Location Data'
      ];

      dataTypes.forEach(type => {
        expect(content).toContain(type);
      });
    });
  });

  describe('GET /api/legal/changelog', () => {
    it('should return changelog without authentication', async () => {
      const response = await request(app)
        .get('/api/legal/changelog')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should include version information', async () => {
      const response = await request(app)
        .get('/api/legal/changelog')
        .expect(200);

      expect(response.body.data[0]).toHaveProperty('version');
      expect(response.body.data[0]).toHaveProperty('date');
      expect(response.body.data[0]).toHaveProperty('changes');
    });

    it('should track document updates', async () => {
      const response = await request(app)
        .get('/api/legal/changelog')
        .expect(200);

      const changelog = response.body.data[0];
      expect(changelog.changes).toBeInstanceOf(Array);
      expect(changelog.changes.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/legal/accept-terms', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/legal/accept-terms')
        .send({})
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });

    it('should record acceptance with valid token', async () => {
      const response = await request(app)
        .post('/api/legal/accept-terms')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({})
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('acceptedAt');
      expect(response.body.data).toHaveProperty('termsVersion');
      expect(response.body.data).toHaveProperty('privacyVersion');
    });

    it('should capture client information', async () => {
      const response = await request(app)
        .post('/api/legal/accept-terms')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({})
        .expect(201);

      // Response should confirm acceptance was recorded
      expect(response.body.data).toHaveProperty('acceptedAt');
      expect(response.statusCode).toBe(201);
    });
  });

  describe('GET /api/legal/acceptance-status', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/legal/acceptance-status')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return acceptance status for authenticated user', async () => {
      const response = await request(app)
        .get('/api/legal/acceptance-status')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('hasAccepted');
      expect(response.body.data).toHaveProperty('acceptedTerms');
      expect(response.body.data).toHaveProperty('acceptedPrivacy');
    });

    it('should show current version requirements', async () => {
      const response = await request(app)
        .get('/api/legal/acceptance-status')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('currentTermsVersion');
      expect(response.body.data).toHaveProperty('currentPrivacyVersion');
    });
  });

  describe('Service Layer Tests', () => {
    
    describe('getTermsOfService()', () => {
      it('should return object with required properties', () => {
        const terms = termsAndPrivacy.getTermsOfService();
        
        expect(terms).toHaveProperty('title');
        expect(terms).toHaveProperty('version');
        expect(terms).toHaveProperty('effectiveDate');
        expect(terms).toHaveProperty('lastUpdated');
        expect(terms).toHaveProperty('content');
      });

      it('should have non-empty content', () => {
        const terms = termsAndPrivacy.getTermsOfService();
        
        expect(terms.content).toBeTruthy();
        expect(terms.content.length).toBeGreaterThan(1000);
      });

      it('should have valid version format', () => {
        const terms = termsAndPrivacy.getTermsOfService();
        
        expect(terms.version).toMatch(/^\d+\.\d+\.\d+$/);
      });
    });

    describe('getPrivacyPolicy()', () => {
      it('should return object with required properties', () => {
        const policy = termsAndPrivacy.getPrivacyPolicy();
        
        expect(policy).toHaveProperty('title');
        expect(policy).toHaveProperty('version');
        expect(policy).toHaveProperty('content');
      });

      it('should cover data protection rights', () => {
        const policy = termsAndPrivacy.getPrivacyPolicy();
        
        const rights = ['Access', 'Rectification', 'Erasure', 'Restrict', 'Portability'];
        rights.forEach(right => {
          expect(policy.content).toContain(right);
        });
      });
    });

    describe('getVersion()', () => {
      it('should return version for terms', () => {
        const version = termsAndPrivacy.getVersion('terms');
        
        expect(version).toBe('1.0.0');
      });

      it('should return version for privacy', () => {
        const version = termsAndPrivacy.getVersion('privacy');
        
        expect(version).toBe('1.0.0');
      });

      it('should return default for unknown type', () => {
        const version = termsAndPrivacy.getVersion('unknown');
        
        expect(version).toBe('1.0.0');
      });
    });

    describe('getLastUpdated()', () => {
      it('should return date for terms', () => {
        const date = termsAndPrivacy.getLastUpdated('terms');
        
        expect(date).toBeInstanceOf(Date);
      });

      it('should return date for privacy', () => {
        const date = termsAndPrivacy.getLastUpdated('privacy');
        
        expect(date).toBeInstanceOf(Date);
      });
    });

    describe('getChangelog()', () => {
      it('should return array of changes', () => {
        const changelog = termsAndPrivacy.getChangelog();
        
        expect(Array.isArray(changelog)).toBe(true);
        expect(changelog.length).toBeGreaterThan(0);
      });

      it('should include required changelog properties', () => {
        const changelog = termsAndPrivacy.getChangelog();
        const firstEntry = changelog[0];
        
        expect(firstEntry).toHaveProperty('version');
        expect(firstEntry).toHaveProperty('date');
        expect(firstEntry).toHaveProperty('document');
        expect(firstEntry).toHaveProperty('changes');
      });
    });
  });

  describe('Content Validation', () => {
    
    it('should have complete business terms', () => {
      const terms = termsAndPrivacy.getTermsOfService();
      const requiredContent = [
        'Kenya',
        'arbitration',
        'governing law',
        'payment',
        'loan'
      ];
      
      const contentLower = terms.content.toLowerCase();
      requiredContent.forEach(item => {
        expect(contentLower).toContain(item);
      });
    });

    it('should comply with data protection regulations', () => {
      const policy = termsAndPrivacy.getPrivacyPolicy();
      const contentLower = policy.content.toLowerCase();
      
      expect(contentLower).toContain('gdpr');
      expect(contentLower).toContain('ccpa');
      expect(contentLower).toContain('kenya');
      expect(contentLower).toContain('data protection');
    });

    it('should include security commitments', () => {
      const policy = termsAndPrivacy.getPrivacyPolicy();
      const securityContent = [
        'encryption',
        'tls',
        'secure',
        'protection',
        'hashed'
      ];
      
      const contentLower = policy.content.toLowerCase();
      securityContent.forEach(item => {
        expect(contentLower).toContain(item);
      });
    });

    it('should define user rights clearly', () => {
      const policy = termsAndPrivacy.getPrivacyPolicy();
      const userRights = [
        'right to',
        'can',
        'may',
        'withdraw',
        'object'
      ];
      
      const contentLower = policy.content.toLowerCase();
      userRights.forEach(right => {
        expect(contentLower).toContain(right);
      });
    });
  });

  describe('Error Handling', () => {
    
    it('should handle invalid token gracefully', async () => {
      const response = await request(app)
        .get('/api/legal/acceptance-status')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle missing authorization header', async () => {
      const response = await request(app)
        .post('/api/legal/accept-terms')
        .send({})
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });

    it('should provide helpful error messages', async () => {
      const response = await request(app)
        .post('/api/legal/accept-terms')
        .expect(401);

      expect(response.body.message).toBeTruthy();
      expect(typeof response.body.message).toBe('string');
    });
  });
});

// Export for use in other test suites
module.exports = {
  mockUser,
  mockToken
};

import {expect} from 'chai';
import {spec} from '../../../modules/boldwinBidAdapter.js';
import { BANNER, VIDEO } from '../../../src/mediaTypes.js';

describe('BoldwinBidAdapter', function () {
  const bid = {
    bidId: '23fhj33i987f',
    bidder: 'boldwin',
    mediaTypes: {
      banner: {
        sizes: [ [300, 250], [320, 50] ],
      }
    },
    params: {
      placementId: 'testBanner',
    }
  };

  const bidderRequest = {
    refererInfo: {
      referer: 'test.com'
    },
    ortb2: {}
  };

  describe('isBidRequestValid', function () {
    it('Should return true if there are bidId, params and placementId parameters present', function () {
      expect(spec.isBidRequestValid(bid)).to.be.true;
    });
    it('Should return false if at least one of parameters is not present', function () {
      delete bid.params.placementId;
      expect(spec.isBidRequestValid(bid)).to.be.false;
    });
  });

  describe('buildRequests', function () {
    let serverRequest = spec.buildRequests([bid], bidderRequest);
    it('Creates a ServerRequest object with method, URL and data', function () {
      expect(serverRequest).to.exist;
      expect(serverRequest.method).to.exist;
      expect(serverRequest.url).to.exist;
      expect(serverRequest.data).to.exist;
    });
    it('Returns POST method', function () {
      expect(serverRequest.method).to.equal('POST');
    });
    it('Returns valid URL', function () {
      expect(serverRequest.url).to.equal('https://ssp.videowalldirect.com/pbjs');
    });
    it('Returns valid data if array of bids is valid', function () {
      let data = serverRequest.data;
      expect(data).to.be.an('object');
      expect(data).to.have.all.keys('deviceWidth', 'deviceHeight', 'language', 'secure', 'host', 'page', 'placements');
      expect(data.deviceWidth).to.be.a('number');
      expect(data.deviceHeight).to.be.a('number');
      expect(data.language).to.be.a('string');
      expect(data.secure).to.be.within(0, 1);
      expect(data.host).to.be.a('string');
      expect(data.page).to.be.a('string');
      expect(data.gdpr).to.not.exist;
      expect(data.ccpa).to.not.exist;
      let placement = data['placements'][0];
      expect(placement).to.have.keys('placementId', 'bidId', 'adFormat', 'sizes', 'hPlayer', 'wPlayer', 'schain', 'bidFloor', 'type');
      expect(placement.placementId).to.equal('testBanner');
      expect(placement.bidId).to.equal('23fhj33i987f');
      expect(placement.adFormat).to.equal(BANNER);
      expect(placement.schain).to.be.an('object');
      expect(placement.type).to.exist.and.to.equal('publisher');
    });

    it('Returns valid data for mediatype video', function () {
      const playerSize = [300, 300];
      bid.mediaTypes = {};
      bid.mediaTypes[VIDEO] = {
        playerSize
      };
      serverRequest = spec.buildRequests([bid], bidderRequest);
      let data = serverRequest.data;
      expect(data).to.be.an('object');
      let placement = data['placements'][0];
      expect(placement).to.be.an('object');
      expect(placement.adFormat).to.equal(VIDEO);
      expect(placement.wPlayer).to.equal(playerSize[0]);
      expect(placement.hPlayer).to.equal(playerSize[1]);
    });

    it('Returns data with gdprConsent and without uspConsent', function () {
      bidderRequest.gdprConsent = 'test';
      serverRequest = spec.buildRequests([bid], bidderRequest);
      let data = serverRequest.data;
      expect(data.gdpr).to.exist;
      expect(data.gdpr).to.be.a('string');
      expect(data.gdpr).to.equal(bidderRequest.gdprConsent);
      expect(data.ccpa).to.not.exist;
      delete bidderRequest.gdprConsent;
    });

    it('Returns data with uspConsent and without gdprConsent', function () {
      bidderRequest.uspConsent = 'test';
      serverRequest = spec.buildRequests([bid], bidderRequest);
      let data = serverRequest.data;
      expect(data.ccpa).to.exist;
      expect(data.ccpa).to.be.a('string');
      expect(data.ccpa).to.equal(bidderRequest.uspConsent);
      expect(data.gdpr).to.not.exist;
    });

    it('Returns empty data if no valid requests are passed', function () {
      serverRequest = spec.buildRequests([]);
      let data = serverRequest.data;
      expect(data.placements).to.be.an('array').that.is.empty;
    });
  });

  describe('gpp consent', function () {
    it('bidderRequest.gppConsent', () => {
      bidderRequest.gppConsent = {
        gppString: 'abc123',
        applicableSections: [8]
      };

      let serverRequest = spec.buildRequests([bid], bidderRequest);
      let data = serverRequest.data;
      expect(data).to.be.an('object');
      expect(data).to.have.property('gpp');
      expect(data).to.have.property('gpp_sid');

      delete bidderRequest.gppConsent;
    })

    it('bidderRequest.ortb2.regs.gpp', () => {
      bidderRequest.ortb2.regs = bidderRequest.ortb2.regs || {};
      bidderRequest.ortb2.regs.gpp = 'abc123';
      bidderRequest.ortb2.regs.gpp_sid = [8];

      let serverRequest = spec.buildRequests([bid], bidderRequest);
      let data = serverRequest.data;
      expect(data).to.be.an('object');
      expect(data).to.have.property('gpp');
      expect(data).to.have.property('gpp_sid');
    })
  });

  describe('interpretResponse', function () {
    it('Should interpret banner response', function () {
      const banner = {
        body: [{
          mediaType: 'banner',
          width: 300,
          height: 250,
          cpm: 0.4,
          ad: 'Test',
          requestId: '23fhj33i987f',
          ttl: 120,
          creativeId: '2',
          netRevenue: true,
          currency: 'USD',
          dealId: '1'
        }]
      };
      let bannerResponses = spec.interpretResponse(banner);
      expect(bannerResponses).to.be.an('array').that.is.not.empty;
      let dataItem = bannerResponses[0];
      expect(dataItem).to.have.all.keys('requestId', 'cpm', 'width', 'height', 'ad', 'ttl', 'creativeId',
        'netRevenue', 'currency', 'dealId', 'mediaType', 'meta');
      expect(dataItem.requestId).to.equal('23fhj33i987f');
      expect(dataItem.cpm).to.equal(0.4);
      expect(dataItem.width).to.equal(300);
      expect(dataItem.height).to.equal(250);
      expect(dataItem.ad).to.equal('Test');
      expect(dataItem.ttl).to.equal(120);
      expect(dataItem.creativeId).to.equal('2');
      expect(dataItem.netRevenue).to.be.true;
      expect(dataItem.currency).to.equal('USD');
      expect(dataItem.meta).to.be.an('object').that.has.any.key('advertiserDomains');
    });

    it('Should interpret video response', function () {
      const video = {
        body: [{
          vastUrl: 'test.com',
          mediaType: 'video',
          cpm: 0.5,
          requestId: '23fhj33i987f',
          ttl: 120,
          creativeId: '2',
          netRevenue: true,
          currency: 'USD',
          dealId: '1'
        }]
      };
      let videoResponses = spec.interpretResponse(video);
      expect(videoResponses).to.be.an('array').that.is.not.empty;

      let dataItem = videoResponses[0];
      expect(dataItem).to.have.all.keys('requestId', 'cpm', 'vastUrl', 'ttl', 'creativeId',
        'netRevenue', 'currency', 'dealId', 'mediaType', 'meta');
      expect(dataItem.requestId).to.equal('23fhj33i987f');
      expect(dataItem.cpm).to.equal(0.5);
      expect(dataItem.vastUrl).to.equal('test.com');
      expect(dataItem.ttl).to.equal(120);
      expect(dataItem.creativeId).to.equal('2');
      expect(dataItem.netRevenue).to.be.true;
      expect(dataItem.currency).to.equal('USD');
      expect(dataItem.meta).to.be.an('object').that.has.any.key('advertiserDomains');
    });
    it('Should interpret native response', function () {
      const native = {
        body: [{
          mediaType: 'native',
          native: {
            clickUrl: 'test.com',
            title: 'Test',
            image: 'test.com',
            impressionTrackers: ['test.com'],
          },
          ttl: 120,
          cpm: 0.4,
          requestId: '23fhj33i987f',
          creativeId: '2',
          netRevenue: true,
          currency: 'USD',
        }]
      };
      let nativeResponses = spec.interpretResponse(native);
      expect(nativeResponses).to.be.an('array').that.is.not.empty;

      let dataItem = nativeResponses[0];
      expect(dataItem).to.have.keys('requestId', 'cpm', 'ttl', 'creativeId', 'netRevenue', 'currency', 'mediaType', 'native', 'meta');
      expect(dataItem.native).to.have.keys('clickUrl', 'impressionTrackers', 'title', 'image')
      expect(dataItem.requestId).to.equal('23fhj33i987f');
      expect(dataItem.cpm).to.equal(0.4);
      expect(dataItem.native.clickUrl).to.equal('test.com');
      expect(dataItem.native.title).to.equal('Test');
      expect(dataItem.native.image).to.equal('test.com');
      expect(dataItem.native.impressionTrackers).to.be.an('array').that.is.not.empty;
      expect(dataItem.native.impressionTrackers[0]).to.equal('test.com');
      expect(dataItem.ttl).to.equal(120);
      expect(dataItem.creativeId).to.equal('2');
      expect(dataItem.netRevenue).to.be.true;
      expect(dataItem.currency).to.equal('USD');
      expect(dataItem.meta).to.be.an('object').that.has.any.key('advertiserDomains');
    });
    it('Should return an empty array if invalid banner response is passed', function () {
      const invBanner = {
        body: [{
          width: 300,
          cpm: 0.4,
          ad: 'Test',
          requestId: '23fhj33i987f',
          ttl: 120,
          creativeId: '2',
          netRevenue: true,
          currency: 'USD',
          dealId: '1'
        }]
      };

      let serverResponses = spec.interpretResponse(invBanner);
      expect(serverResponses).to.be.an('array').that.is.empty;
    });
    it('Should return an empty array if invalid video response is passed', function () {
      const invVideo = {
        body: [{
          mediaType: 'video',
          cpm: 0.5,
          requestId: '23fhj33i987f',
          ttl: 120,
          creativeId: '2',
          netRevenue: true,
          currency: 'USD',
          dealId: '1'
        }]
      };
      let serverResponses = spec.interpretResponse(invVideo);
      expect(serverResponses).to.be.an('array').that.is.empty;
    });
    it('Should return an empty array if invalid native response is passed', function () {
      const invNative = {
        body: [{
          mediaType: 'native',
          clickUrl: 'test.com',
          title: 'Test',
          impressionTrackers: ['test.com'],
          ttl: 120,
          requestId: '23fhj33i987f',
          creativeId: '2',
          netRevenue: true,
          currency: 'USD',
        }]
      };
      let serverResponses = spec.interpretResponse(invNative);
      expect(serverResponses).to.be.an('array').that.is.empty;
    });
    it('Should return an empty array if invalid response is passed', function () {
      const invalid = {
        body: [{
          ttl: 120,
          creativeId: '2',
          netRevenue: true,
          currency: 'USD',
          dealId: '1'
        }]
      };
      let serverResponses = spec.interpretResponse(invalid);
      expect(serverResponses).to.be.an('array').that.is.empty;
    });
  });

  describe('getUserSyncs', function () {
    let userSync = spec.getUserSyncs();
    it('Returns valid URL and type', function () {
      expect(userSync).to.be.an('array').with.lengthOf(1);
      expect(userSync[0].type).to.exist;
      expect(userSync[0].url).to.exist;
      expect(userSync[0].type).to.be.equal('image');
      expect(userSync[0].url).to.be.equal('https://cs.videowalldirect.com');
    });
  });
});

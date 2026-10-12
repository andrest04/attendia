import 'dotenv/config';
import Twilio from 'twilio';

/*
 * The one Twilio REST client for this process. ES module caching makes this a singleton,
 * so no hand-rolled getInstance() is needed. It is kept apart from twilioGateway.ts on
 * purpose: constructing a client requires credentials in the environment, and the
 * gateway's pure functions must stay importable (and testable) without them.
 */
export const twilioConfig = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  apiKeySid: process.env.TWILIO_API_KEY_SID,
  apiKeySecret: process.env.TWILIO_API_KEY_SECRET,
  conversationsServiceSid: process.env.TWILIO_CONVERSATIONS_SERVICE_SID,
  environment: process.env.REACT_APP_TWILIO_ENVIRONMENT,
};

export const twilioClient = Twilio(twilioConfig.apiKeySid, twilioConfig.apiKeySecret, {
  accountSid: twilioConfig.accountSid,
  region: twilioConfig.environment === 'prod' ? undefined : twilioConfig.environment,
});

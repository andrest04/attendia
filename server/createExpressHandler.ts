import 'dotenv/config';
import type { Request, Response } from 'express';
import type { ServerlessContext, ServerlessFunction } from './types';
import Twilio from 'twilio';

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_API_KEY_SID,
  TWILIO_API_KEY_SECRET,
  TWILIO_CONVERSATIONS_SERVICE_SID,
  REACT_APP_TWILIO_ENVIRONMENT,
} = process.env;

export const twilioClient = Twilio(TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, {
  accountSid: TWILIO_ACCOUNT_SID,
  region: REACT_APP_TWILIO_ENVIRONMENT === 'prod' ? undefined : REACT_APP_TWILIO_ENVIRONMENT,
});

const context: ServerlessContext = {
  ACCOUNT_SID: TWILIO_ACCOUNT_SID,
  TWILIO_API_KEY_SID,
  TWILIO_API_KEY_SECRET,
  ROOM_TYPE: 'group',
  CONVERSATIONS_SERVICE_SID: TWILIO_CONVERSATIONS_SERVICE_SID,
  getTwilioClient: () => twilioClient,
};

export function createExpressHandler(serverlessFunction: ServerlessFunction) {
  return (req: Request, res: Response) => {
    // plugin-rtc's token.js can invoke the callback more than once (e.g. the bad-passcode
    // path), which would otherwise throw "Cannot set headers after they are sent". Guard so
    // only the first send wins, and recover with a 500 if the serverless promise rejects
    // without ever responding (instead of leaving the request hanging).
    let responded = false;

    Promise.resolve(
      serverlessFunction(context, req.body, (_, serverlessResponse) => {
        if (responded || res.headersSent) {
          return;
        }
        responded = true;

        const { statusCode, headers, body } = serverlessResponse;

        res
          .status(statusCode)
          .set(headers)
          .json(body);
      })
    ).catch(() => {
      if (responded || res.headersSent) {
        return;
      }
      responded = true;

      res.status(500).json({ error: { message: 'Internal server error' } });
    });
  };
}

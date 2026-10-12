import type { Request, Response } from 'express';
import type { ServerlessContext, ServerlessFunction } from './types';
import { twilioClient, twilioConfig } from './twilioClient';

const context: ServerlessContext = {
  ACCOUNT_SID: twilioConfig.accountSid,
  TWILIO_API_KEY_SID: twilioConfig.apiKeySid,
  TWILIO_API_KEY_SECRET: twilioConfig.apiKeySecret,
  ROOM_TYPE: 'group',
  CONVERSATIONS_SERVICE_SID: twilioConfig.conversationsServiceSid,
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

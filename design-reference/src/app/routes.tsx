import { createBrowserRouter } from 'react-router';
import { Root } from './components/Root';
import { S1_Access } from './components/screens/S1_Access';
import { S2_WaitingRoom } from './components/screens/S2_WaitingRoom';
import { S3_StudentSession } from './components/screens/S3_StudentSession';
import { S4_ProfessorSession } from './components/screens/S4_ProfessorSession';
import { S5_ProctoringAlert } from './components/screens/S5_ProctoringAlert';
import { S6_AttentionReport } from './components/screens/S6_AttentionReport';
import { S7_Onboarding } from './components/screens/S7_Onboarding';
import { S8_Security } from './components/screens/S8_Security';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      { index: true, Component: S1_Access },
      { path: 's2', Component: S2_WaitingRoom },
      { path: 's3', Component: S3_StudentSession },
      { path: 's4', Component: S4_ProfessorSession },
      { path: 's5', Component: S5_ProctoringAlert },
      { path: 's6', Component: S6_AttentionReport },
      { path: 's7', Component: S7_Onboarding },
      { path: 's8', Component: S8_Security },
    ],
  },
]);

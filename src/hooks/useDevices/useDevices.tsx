import { useState, useEffect } from 'react';
import { getDeviceInfo } from '../../utils';

// This returns the type of the value that is returned by a promise resolution
type ThenArg<T> = T extends PromiseLike<infer U> ? U : never;

export default function useDevices() {
  const [deviceInfo, setDeviceInfo] = useState<ThenArg<ReturnType<typeof getDeviceInfo>>>({
    audioInputDevices: [],
    videoInputDevices: [],
    audioOutputDevices: [],
    hasAudioInputDevices: false,
    hasVideoInputDevices: false,
  });

  useEffect(() => {
    // getDeviceInfo() is async; guard against resolving after the component has
    // unmounted (e.g. the prejoin screen unmounting on join) to avoid a setState
    // on an unmounted component.
    let isMounted = true;
    const getDevices = () =>
      getDeviceInfo().then(devices => {
        if (isMounted) setDeviceInfo(devices);
      });
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    getDevices();

    return () => {
      isMounted = false;
      navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    };
  }, []);

  return deviceInfo;
}

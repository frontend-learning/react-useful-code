import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';

const DEFAULT_MESSAGE = 'Are you sure you want to leave this page?';

type Props = {
  message?: string;
};

function useLeaveConfirm({ message = '' }: Props = {}) {
  const Router = useRouter();
  const isDirtyRef = useRef(false);
  const finalMSG = useMemo(
    () => message || DEFAULT_MESSAGE,
    [Router.locale, message]
  );

  const onRouteChangeStart = useCallback(() => {
    if (isDirtyRef.current) {
      // eslint-disable-next-line no-alert
      if (window.confirm(finalMSG)) {
        return true;
      }

      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw "Abort route change by user's confirmation.";
    }

    return null;
  }, [finalMSG]);

  const handleBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
    if (isDirtyRef.current) {
      event.preventDefault();
    }

    return undefined;
  }, []);

  useEffect(() => {
    Router.events.on('routeChangeStart', onRouteChangeStart);

    return () => {
      Router.events.off('routeChangeStart', onRouteChangeStart);
    };
  }, [Router.events, onRouteChangeStart]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.onbeforeunload = handleBeforeUnload;
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.onbeforeunload = null;
      }
    };
  }, [handleBeforeUnload]);

  return isDirtyRef;
}

export default useLeaveConfirm;

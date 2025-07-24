import { Bounce, ToastContainer as ToastContainerLib } from 'react-toastify';

export const ToastContainer = () => {
  return (
    <ToastContainerLib
      position="top-right"
      autoClose={5000}
      hideProgressBar={false}
      newestOnTop={false}
      closeOnClick={false}
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="light"
      transition={Bounce}
      toastStyle={{
        minHeight: 'fit-content',
      }}
    />
  );
};

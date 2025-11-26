"use client";

type Props = {
  setState: (v: any) => void;
};

export const SignInCard = ({ setState }: Props) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg text-black">
      <h2 className="text-xl font-bold mb-4">Sign In</h2>
      <button
        className="text-blue-500 underline"
        onClick={() => setState("signUp")}
      >
        Don’t have an account? Sign Up
      </button>
    </div>
  );
};

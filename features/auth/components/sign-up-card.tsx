"use client";

type Props = {
  setState: (v: any) => void;
};

export const SignUpCard = ({ setState }: Props) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg text-black">
      <h2 className="text-xl font-bold mb-4">Sign Up</h2>
      <button
        className="text-blue-500 underline"
        onClick={() => setState("signIn")}
      >
        Already have an account? Sign In
      </button>
    </div>
  );
};

import clickSound from "@/assets/sounds/click.mp3";
import successSound from "@/assets/sounds/success.mp3";
import approvedSound from "@/assets/sounds/approved.mp3";

const clickAudio = new Audio(clickSound);
const successAudio = new Audio(successSound);
const approvedAudio = new Audio(approvedSound);

clickAudio.volume = 0.4;
successAudio.volume = 0.6;
approvedAudio.volume = 0.7;

export const playClick = () => {
  clickAudio.currentTime = 0;
  clickAudio.play().catch(() => {});
};

export const playSuccess = () => {
  successAudio.currentTime = 0;
  successAudio.play().catch(() => {});
};

export const playApproved = () => {
  approvedAudio.currentTime = 0;
  approvedAudio.play().catch(() => {});
};


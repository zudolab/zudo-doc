import { renderRobots } from "@takazudo/zudo-doc/robots";
import { settings } from "@/config/settings";

export const contentType = "text/plain";
export default () => renderRobots(settings);

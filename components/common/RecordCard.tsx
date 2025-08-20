
import React from 'react';
import { CultivationRecord, WorkType, CropStage, ObservationStatus } from '../../types';
import { LeafIcon } from '../Icons';
import { parseDateString } from '../../lib/utils';
import { WORK_TYPE_DETAILS, CROP_STAGE_DETAILS, OBSERVATION_STATUS_DETAILS, FERTILIZERS } from '../../lib/constants';

export const RecordCard: React.FC<{ record: CultivationRecord; onClick: () => void }> = ({ record, onClick }) => {
  const workTypesToDisplay = record.workTypes || [];
  const cropStagesToDisplay = record.cropStages || [];
  
  const dateObj = parseDateString(record.date);
  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];
  const formattedDate = `${dateObj.toLocaleDateString()} (${dayOfWeek})`;

  return (
    <button onClick={onClick} className="w-full bg-yellow-50 dark:bg-gray-800 rounded-xl shadow-md overflow-hidden fade-in flex text-left hover:shadow-lg transition-shadow">
        <div className="w-2/3 p-4 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{record.cultivationLane} 【{record.cropName}】</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{formattedDate}</p>
          
            <div className="space-y-2 mt-3 text-xs">
              {workTypesToDisplay.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-600 dark:text-gray-300 w-12 shrink-0">作業:</span>
                    <div className="flex flex-wrap gap-1">
                      {workTypesToDisplay.map(type => {
                        const details = WORK_TYPE_DETAILS[type as WorkType];
                        let label = details?.label || type;

                        if (type === WorkType.Fertilizing) {
                            const detailsArray = record.fertilizingDetails 
                              ? (Array.isArray(record.fertilizingDetails) ? record.fertilizingDetails : [record.fertilizingDetails])
                              : [];
                            
                            if (detailsArray.length > 0) {
                              const detailsText = detailsArray.map(d => 
                                `${FERTILIZERS[d.fertilizerType].name.replace('エムプラス', '')}:${d.dilution}倍`
                              ).join(', ');
                              label = `${label} (${detailsText})`;
                            }
                        }
                        return <span key={type} className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 px-2 py-0.5 rounded-full">{label}</span>;
                      })}
                    </div>
                  </div>
              )}
              {cropStagesToDisplay.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-600 dark:text-gray-300 w-12 shrink-0">状況:</span>
                    <div className="flex flex-wrap gap-1">
                      {cropStagesToDisplay.map(stage => {
                        const details = CROP_STAGE_DETAILS[stage as CropStage];
                        return <span key={stage} className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 px-2 py-0.5 rounded-full">{details?.label || stage}</span>;
                      })}
                    </div>
                  </div>
              )}
              {record.observationStatus && record.observationStatus.length > 0 && (
                  <div className="flex items-start gap-2">
                     <span className="font-semibold text-gray-600 dark:text-gray-300 w-12 shrink-0">観察:</span>
                    <div className="flex flex-wrap gap-1">
                        {record.observationStatus.map(status => (
                            <span key={status} className="bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 px-2 py-0.5 rounded-full">
                                {OBSERVATION_STATUS_DETAILS[status as ObservationStatus]?.label || status}
                            </span>
                        ))}
                    </div>
                  </div>
              )}
              {record.pestDetails && record.pestDetails.length > 0 && (
                  <div className="flex items-start gap-2">
                     <span className="font-semibold text-gray-600 dark:text-gray-300 w-12 shrink-0">病害虫:</span>
                    <div className="flex flex-wrap gap-1">
                        {record.pestDetails.map(pest => (
                            <span key={pest} className="bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 px-2 py-0.5 rounded-full">
                                {pest}
                            </span>
                        ))}
                    </div>
                  </div>
              )}
            </div>
          </div>
          
          {record.memo && <p className="mt-3 text-gray-700 dark:text-gray-300 text-xs bg-gray-50 dark:bg-gray-700 p-2 rounded-md whitespace-pre-wrap break-words">{record.memo}</p>}
        </div>
        <div className="w-1/3 bg-gray-200 dark:bg-gray-700">
          {record.photoBase64 ? (
            <img src={record.photoBase64} alt={record.cropName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <LeafIcon className="h-12 w-12 text-gray-400 dark:text-gray-500" />
            </div>
          )}
        </div>
    </button>
  );
};
